var moment = require('moment-timezone');
var ibapi = require('ibapi');
var messageIds = ibapi.messageIds;
var TIMEZONE = require('./googleCSVReader').TIMEZONE;
var TradeController = require('./tradeController');
var BUY = TradeController.BUY;
var SELL = TradeController.SELL;
var Company = require('./company');

var cancelIds = {};
var symbols = {};

var createCompanies = function() {
  var companies = [new Company('ES')];
  for (var i = companies.length; i--;) {
    var company = companies[i];
    cancelIds[company.cancelId] = company;
    symbols[company.symbol] = company;
  }
  return companies;
};

var api = new ibapi.NodeIbapi();
var apiClient = api.client;

// Interactive Broker requires that you use orderId for every new order
//  inputted. The orderId is incremented everytime you submit an order.
//  Make sure you keep track of this.
var orderId = -1;
var ignoreOrderId = -1;

// Singleton order object
var newOrder = ibapi.order.createOrder();
newOrder.auxPrice = 0.0;
newOrder.hidden = false;
newOrder.tif = 'GTC';
newOrder.outsideRth = false; // true; // false for futures, true for stocks
newOrder.percentOffset = 0; // bug workaround

var getMktData = function(company) {
  api.reqMktData(company.cancelId, company.contract, '', false);
};

var placeMyOrder = function(company, action, quantity, orderType, lmtPrice, oldId) {
  if (!oldId) {
    oldId = company.orderId = orderId++;
  }
  newOrder.action = action;
  newOrder.totalQuantity = quantity;
  newOrder.orderType = orderType;
  newOrder.lmtPrice = lmtPrice;
  apiClient.placeOrder(oldId, company.contract, newOrder); // avoid rate limitter
  console.log('Placing order for', oldId, company.symbol, newOrder, company.bid, company.ask);
};

// Here we specify the event handlers.
//  Please follow this guideline for event handlers:
//  1. Add handlers to listen to messages
//  2. Each handler must have be a function (message) signature
var handleValidOrderId = function(message) {
  var companies = createCompanies();
  orderId = message.orderId;
  ignoreOrderId = orderId;
  console.log('next order Id is', orderId);
  api.reqAllOpenOrders();
  for (var i = companies.length; i--;) {
    var company = companies[i];
    getMktData(company);
    if (process.argv[2]) {
      kick(company);
    }
  }
};

var cancelPrevOrder = function(prevOrderId) {
  if (prevOrderId > 0) { // cannot cancel negative order id or zero
    console.log('canceling order: %d', prevOrderId);
    apiClient.cancelOrder(prevOrderId); // avoid rate limitter
  }
};

var handleServerError = function(message) {
  var errorCode = message.errorCode;
  if (errorCode === 2109) { // ignore
    return;
  }
  console.log(Date(), '[ServerError]', message);
  if (errorCode === 1101 || errorCode === 1102 || errorCode === 1300) {
    process.exit(1);
  }
};

var handleConnectionClosed = function(message) {
  console.log(Date(), '[ConnectionClosed]', message);
  process.exit(1);
};

// var date = moment.tz(TIMEZONE);
// var minute = date.minutes();
// var hour = date.hours();
// var noPosition = (hour < 9) || (hour >= 15) || (minute < 21 && hour === 9) || (minute > 20 && hour === 14); // starts earlier than regular trading hours

var handleTickPrice = function(tickPrice) {
  console.log('tickPrice:', JSON.stringify(tickPrice));
  var company = cancelIds[tickPrice.tickerId];
  var field = tickPrice.field;
  var price = tickPrice.price;
  var canAutoExecute = tickPrice.canAutoExecute;
  if (company && price && price > 0.0) {
    var key = -1;
    var order;
    var i = 0;
    if (field === 1 && canAutoExecute) { // bid price
      var bid = company.bid;
      company.bid = price;
      if (bid < price && bid) {
        var lLots = company.lLots;
        var lLotKeys = Object.keys(lLots);
        for (i = lLotKeys.length; i--;) {
          key = parseInt(lLotKeys[i]);
          if (key < ignoreOrderId) {
            continue;
          }
          order = lLots[key];
          //placeMyOrder(company, order.action, order.totalQuantity, 'LMT', price, key); // modify order
        }
      }
    } else if (field === 2 && canAutoExecute) { // ask price
      var ask = company.ask;
      company.ask = price;
      if (ask > price && ask) {
        var sLots = company.sLots;
        var sLotKeys = Object.keys(sLots);
        for (i = sLotKeys.length; i--;) {
          key = parseInt(sLotKeys[i]);
          if (key < ignoreOrderId) {
            continue;
          }
          order = sLots[key];
          //placeMyOrder(company, order.action, order.totalQuantity, 'LMT', price, key); // modify order
        }
      }
    } else if (field === 9) { // last day close
      company.setCaps(price);
      console.log('last day close', price, company);
    }
  }
};

// for debugging
var limit = 1;
var count = 0;

var handleOpenOrder = function(message) {
  console.log('OpenOrder:', JSON.stringify(message));
  var oId = message.orderId;
  if (oId < ignoreOrderId) {
    return;
  }
  var orderStatus = message.orderState.status;
  var company = symbols[message.contract.symbol];
  if (company) {
    var order = message.order;
    var action = order.action;
    var sLots = company.sLots;
    var lLots = company.lLots;
    var lLotsLength = company.lLotsLength;
    var sLotsLength = company.sLotsLength;
    if (orderStatus === 'Inactive') {
      cancelPrevOrder(oId);
    } else if (orderStatus === 'Filled' || orderStatus === 'Cancelled') {
      if (action === SELL) {
        if (sLots[oId]) {
          delete sLots[oId];
          sLotsLength -= 1;
        }
      } else if (action === BUY) {
        if (lLots[oId]) {
          delete lLots[oId];
          lLotsLength -= 1;
        }
      }
      console.log('[Delete lots]', company.symbol, lLotsLength, sLotsLength);
    } else {
      if (action === SELL) {
        sLots[oId] = order;
      } else if (action === BUY) {
        lLots[oId] = order;
      }
      console.log('[Append lots]', company.symbol, lLotsLength, sLotsLength);
    }
    var maxLot = company.maxLot;
    var bid = company.bid;
    var ask = company.ask;
    var hardLMaxPrice = company.hardLMaxPrices[lLotsLength];
    var hardSMinPrice = company.hardSMinPrices[sLotsLength];
    if (bid > hardLMaxPrice || ask < hardSMinPrice || !hardLMaxPrice || !hardSMinPrice || !bid || !ask) {
      console.log('[WARNING] order ignored since the bid and ask are', bid, ask, ', which is less/more than the threshold', hardLMaxPrice, hardSMinPrice);
    } else if (lLotsLength < maxLot && sLotsLength < maxLot && count < limit) {
      var onePosition = company.onePosition;
      placeMyOrder(company, BUY, onePosition, 'LMT', bid, 0);
      lLotsLength += 1;
      lLots[company.orderId] = {action: BUY, totalQuantity: onePosition};
      placeMyOrder(company, SELL, onePosition, 'LMT', ask, 0);
      sLotsLength += 1;
      sLots[company.orderId] = {action: SELL, totalQuantity: onePosition};
      count += 1;
      console.log('count', count);
    }
    company.lLotsLength = lLotsLength;
    company.sLotsLength = sLotsLength;
  }
};

var kick = function(company) {
  var sLots = company.sLots;
  var lLots = company.lLots;
  var lLotsLength = company.lLotsLength;
  var sLotsLength = company.sLotsLength;
  var maxLot = company.maxLot;
  var bid = company.bid;
  var ask = company.ask;
  var hardLMaxPrice = company.hardLMaxPrices[lLotsLength];
  var hardSMinPrice = company.hardSMinPrices[sLotsLength];
  if (bid > hardLMaxPrice || ask < hardSMinPrice || !hardLMaxPrice || !hardSMinPrice || !bid || !ask) {
    setTimeout(kick, 1000, company);
  } else if (lLotsLength < maxLot && sLotsLength < maxLot && count < limit) {
    var onePosition = company.onePosition;
    placeMyOrder(company, BUY, onePosition, 'LMT', bid, 0);
    lLotsLength += 1;
    lLots[company.orderId] = {action: BUY, totalQuantity: onePosition};
    placeMyOrder(company, SELL, onePosition, 'LMT', ask, 0);
    sLotsLength += 1;
    sLots[company.orderId] = {action: SELL, totalQuantity: onePosition};
    count += 1;
    console.log('count', count);
  }
  company.lLotsLength = lLotsLength;
  company.sLotsLength = sLotsLength;
};

// After that, you must register the event handler with a messageId
// For list of valid messageIds, see messageIds.js file.
var handlers = api.handlers;
handlers[messageIds.nextValidId] = handleValidOrderId;
handlers[messageIds.error] = handleServerError;
handlers[messageIds.connectionClosed] = handleConnectionClosed;
handlers[messageIds.tickPrice] = handleTickPrice;
handlers[messageIds.openOrder] = handleOpenOrder;

// Connect to the TWS client or IB Gateway
var connected = api.connect('127.0.0.1', 7496, 1);

// Once connected, start processing incoming and outgoing messages
if (connected) {
  if (!api.isProcessing) {
    var processMessage = function() {
      apiClient.checkMessages();
      apiClient.processMsg();
      var msg = apiClient.getInboundMsg();
      var messageId = msg.messageId;
      if (messageId) {
        var handler = handlers[messageId];
        if (handler) {
          handler(msg);
        }
        setImmediate(processMessage); // faster but 100% cpu
      } else {
        setTimeout(processMessage, 0); // slower but less cpu intensive
      }
    };
    setImmediate(processMessage);
    api.isProcessing = true;
  }
} else {
  throw new Error('Failed connecting to localhost TWS/IB Gateway');
}
