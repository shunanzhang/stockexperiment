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
var FIRST_OFFSET = TradeController.FIRST_OFFSET;
var SECOND_OFFSET = TradeController.SECOND_OFFSET;
var L = TradeController.L;
var S = TradeController.S;
var Company = require('./company');
var roundCent = require('./utils').roundCent;

var max = Math.max;
var min = Math.min;

var cancelIds = {};
var symbols = {};
var orderIds = {};

var createCompanies = function() {
  var companies = [new Company('SPY')];
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

var placeMyOrder = function(company, action, quantity, orderType, lmtPrice, auxPrice, track) {
  var oldId = company.orderId = orderId++;
  if (track) {
    orderIds[oldId] = company;
  }
  var newOrder = createOrder();
  newOrder.action = action;
  newOrder.totalQuantity = quantity;
  newOrder.orderType = orderType;
  newOrder.lmtPrice = roundCent(lmtPrice); // roundCent is required to place a correct order
  newOrder.auxPrice = roundCent(auxPrice);
  newOrder.hidden = true;
  newOrder.tif = 'GTC';
  newOrder.outsideRth = true;
  newOrder.percentOffset = 0; // bug workaround
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
  console.log(new Date(), '[ServerError]', message);
  if (message.errorCode === 1101 || message.errorCode === 1102 || message.errorCode === 1300) {
    process.exit(1);
  }
};

var handleClientError = function(message) {
  console.log(new Date(), '[ClientError]', message);
  if (message.errorCode === 1101 || message.errorCode === 1102 || message.errorCode === 1300) {
    process.exit(1);
  }
};

var handleDisconnected = function(message) {
  console.log(new Date(), '[Disconnected]', message);
  if (message.errorCode === 1101 || message.errorCode === 1102 || message.errorCode === 1300) {
    process.exit(1);
  }
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
  var noPosition = (hour < 9) || (hour >= 16) || (minute < 26 && hour === 9) || (minute > 54 && hour === 15); // starts earlier than regular trading hours
  //var noPosition = (hour < 9) || (hour >= 13) || (minute < 26 && hour === 9) || (minute > 54 && hour === 12); // for thanksgiving and christmas
  var result = tradeController.tradeWithRealtimeBar(realtimeBar, noPosition);
  company.resetLowHighCloseOpen();
  console.log(realtimeBar, new Date());
  if (result === HOLD || (company.position + company.onePosition > company.maxPosition && result === BUY) || (company.position - company.onePosition < -company.maxPosition && result === SELL)) {
    return;
  }

  // check if there are shares to sell / money to buy fisrt
  var qty = company.onePosition;
  var limitPrice = close + close * (result === BUY ? FIRST_OFFSET : -FIRST_OFFSET);
  if (limitPrice < company.minPrice || limitPrice > company.maxPrice) {
    console.log('[WARNING] order ignored since the limit price is', limitPrice, ', which is', ((limitPrice < company.minPrice) ? 'less' : 'more'), 'than the threshold', ((limitPrice < company.minPrice) ? company.minPrice : limitPrice < company.maxPrice));
    return;
  }
  var orderType = 'REL';
  placeMyOrder(company, result.toUpperCase(), qty, orderType, limitPrice, 0.01, true);
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
  var oId = message.orderId;
  if (message.status === 'Inactive') {
    cancelPrevOrder(oId);
  }
  var company = orderIds[oId];
  if (company) {
    company.lastOrderStatus = message.status;
    if (message.status === 'Filled') {
      orderIds[oId] = undefined;
      var result = HOLD;
      if (company.command === L) {
        result = SELL;
      } else if (command.command === S) {
        result = BUY;
      } else {
        return;
      }
      var qty = message.filled;
      var avgFillPrice = message.avgFillPrice;
      var limitPrice = avgFillPrice + avgFillPrice * (result === SELL ? SECOND_OFFSET : -SECOND_OFFSET);
      var orderType = 'REL';
      placeMyOrder(company, result.toUpperCase(), qty, orderType, limitPrice, 0.01, false);
    }
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
api.handlers[messageIds.error] = handleServerError;
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
