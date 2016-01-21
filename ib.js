var moment = require('moment-timezone');
var ibapi = require('ibapi');
var messageIds = ibapi.messageIds;
var createOrder = ibapi.order.createOrder;
var GoogleCSVReader = require('./googleCSVReader');
var TIMEZONE = GoogleCSVReader.TIMEZONE;
var TradeController = require('./tradeController');
var BUY = TradeController.BUY;
var SELL = TradeController.SELL;
var HOLD = TradeController.HOLD;
var MINUTES_DAY = TradeController.MINUTES_DAY;
var Company = require('./company');
var roundCent = require('./utils').roundCent;

var abs = Math.abs;
var max = Math.max;
var min = Math.min;

var cancelIds = {};
var symbols = {};
var orderIds = {};

var createCompanies = function() {
  var companies = [new Company('NFLX')];
  for (var i = companies.length; i--;) {
    var company = companies[i];
    cancelIds[company.cancelId] = company;
    symbols[company.symbol] = company;
  }
  return companies;
};

var api = new ibapi.NodeIbapi();

// Interactive Broker requires that you use orderId for every new order
//  inputted. The orderId is incremented everytime you submit an order.
//  Make sure you keep track of this.
var orderId = -1;

var getRealtimeBars = function(company) {
  // only 5 sec is supported, only regular trading ours == true
  api.reqRealtimeBars(company.cancelId, company.contract, 5, 'TRADES', true);
};

var getMktData = function(company) {
  api.reqMktData(company.cancelId, company.contract, '', false);
};

var placeMyOrder = function(company, action, quantity, orderType, lmtPrice, auxPrice) {
  var oldId = company.orderId = orderId++;
  orderIds[oldId] = company;
  var newOrder = createOrder();
  newOrder.action = action;
  newOrder.totalQuantity = quantity;
  newOrder.orderType = orderType;
  newOrder.lmtPrice = roundCent(lmtPrice); // roundCent is required to place a correct order
  newOrder.auxPrice = roundCent(auxPrice);
  newOrder.hidden = true;
  setImmediate(api.placeOrder.bind(api, oldId, company.contract, newOrder));
  console.log('Next valid order Id: %d', oldId);
  console.log('Placing order for', company.symbol, newOrder);
};

// Here we specify the event handlers.
//  Please follow this guideline for event handlers:
//  1. Add handlers to listen to messages
//  2. Each handler must have be a function (message) signature
var handleValidOrderId = function(message) {
  var companies = createCompanies();
  orderId = message.orderId;
  console.log('next order Id is', orderId);
  api.reqPositions();
  for (var i = companies.length; i--;) {
    var company = companies[i];
    getRealtimeBars(company);
    getMktData(company);
  }
};

var cancelPrevOrder = function(prevOrderId) {
  setImmediate(api.cancelOrder.bind(api, prevOrderId));
  console.log('canceling order: %d', prevOrderId);
};

var handleServerError = function(message) {
  console.log('[ServerError]', message.id.toString(), '-', message.errorCode.toString(), '-', message.errorString.toString());
};

var handleClientError = function(message) {
  console.log('[ClientError]', JSON.stringify(message));
};

var handleDisconnected = function(message) {
  process.exit(1);
};

var handleRealTimeBar = function(realtimeBar) {
  var company = cancelIds[realtimeBar.reqId];
  if (!company) {
    console.log('[WARNING] Unknown realtimeBar', realtimeBar);
    return;
  }
  var date = moment.tz((realtimeBar.timeLong + 5) * 1000, TIMEZONE); // realtimeBar time has 5 sec delay, fastforward 5 sec
  var low = company.low = min(realtimeBar.low, company.low);
  var high = company.high = max(realtimeBar.high, company.high);
  var close = company.close = company.close || realtimeBar.close;
  var open = company.open;
  var second = date.seconds();
  if (second <= 57 && second > 3) {
    if (second <= 7) {
      company.resetLowHighClose();
    } else {
      company.open = open || realtimeBar.open;
      if (second > 52 && company.lastOrderStatus !== 'Filled') {
        cancelPrevOrder(company.orderId);
      }
    }
    return; // skip if it is not the end of minutes
  }
  realtimeBar.low = low;
  realtimeBar.high = high;
  realtimeBar.close = close;
  realtimeBar.open = open;
  var tradeController = company.tradeController;
  var minute = date.minutes();
  var hour = date.hours();
  var noPosition = (hour < 9) || (hour >= 16) || (minute < 50 && hour === 9) || (minute > 49 && hour === 15); // always sell a the end of the day
  //var noPosition = (hour < 9) || (hour >= 13) || (minute < 50 && hour === 9) || (minute > 49 && hour === 12); // for thanksgiving and christmas
  var result = tradeController.tradeWithRealtimeBar(realtimeBar, noPosition);
  company.resetLowHighCloseOpen();

  // check if there are shares to sell / money to buy fisrt
  var position = company.position;
  var maxPosition = company.maxPosition;
  var cancelId = company.cancelId;
  var notHold = (result === BUY || result === SELL);
  var qty = abs(position);
  if (result === HOLD && position < 0) {
    result = BUY;
  } else if (result === HOLD && position > 0) {
    result = SELL;
  } else if ((result === BUY && position < 0) || (result === SELL && position > 0)) {
    qty += maxPosition;
  } else if (notHold && maxPosition > qty) {
    qty = maxPosition - qty;
  } else {
    return;
  }
  var limitPrice = close + close * (result === BUY ? 0.00237 : -0.00237);
  if (limitPrice < company.minPrice) {
    console.log('[WARNING] order ignored since the limit price is', limitPrice, ', which is less than the threshold', company.minPrice);
    return;
  }
  var orderType = (noPosition || qty < maxPosition) ? 'MKT' : 'REL';
  placeMyOrder(company, result.toUpperCase(), qty, orderType, limitPrice, close * 0.00010);
  console.log(result, noPosition, position, realtimeBar, new Date());
};

var handleTickPrice = function(tickPrice) {
  var company = cancelIds[tickPrice.tickerId];
  var field = tickPrice.field;
  var price = tickPrice.price;
  if (field === 4 && company) { // last price
    company.low = min(price, company.low);
    company.high = max(price, company.high);
    company.close = price;
    company.open = company.open || price;
  }
};

var handleOrderStatus = function(message) {
  console.log('OrderStatus:', JSON.stringify(message));
  if (message.status === 'Inactive') {
    cancelPrevOrder(message.orderId);
  }
  var company = orderIds[message.orderId];
  if (company) {
    company.lastOrderStatus = message.status;
  }
};

var handlePosition = function(message) {
  console.log('Position:', JSON.stringify(message));
  if (message.contract) {
    var company = symbols[message.contract.symbol];
    if (company) {
      company.position = message.position;
    }
  }
};

// After that, you must register the event handler with a messageId
// For list of valid messageIds, see messageIds.js file.
api.handlers[messageIds.nextValidId] = handleValidOrderId;
api.handlers[messageIds.svrError] = handleServerError;
api.handlers[messageIds.clientError] = handleClientError;
api.handlers[messageIds.disconnected] = handleDisconnected;
api.handlers[messageIds.realtimeBar] = handleRealTimeBar;
api.handlers[messageIds.tickPrice] = handleTickPrice;
api.handlers[messageIds.orderStatus] = handleOrderStatus;
api.handlers[messageIds.position] = handlePosition;

// Connect to the TWS client or IB Gateway
var connected = api.connect('127.0.0.1', 7496, 0);

// Once connected, start processing incoming and outgoing messages
if (connected) {
  api.beginProcessing();
} else {
  throw new Error('Failed connecting to localhost TWS/IB Gateway');
}
