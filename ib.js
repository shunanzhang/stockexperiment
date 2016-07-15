var moment = require('moment-timezone');
var ibapi = require('ibapi');
var messageIds = ibapi.messageIds;
var TIMEZONE = require('./googleCSVReader').TIMEZONE;
var TradeController = require('./tradeController');
var BUY = TradeController.BUY;
var SELL = TradeController.SELL;
var HOLD = TradeController.HOLD;
var OFFSET_POS = TradeController.OFFSET_POS;
var OFFSET_NEG = TradeController.OFFSET_NEG;
var Company = require('./company');
var max = Math.max;
var min = Math.min;
var round = Math.round;

var cancelIds = {};
var symbols = {};
var entryOrderIds = {};
var actions = {};

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

// Singleton order object
var newOrder = ibapi.order.createOrder();
newOrder.hidden = true;
newOrder.tif = 'GTC';
newOrder.outsideRth = true;
newOrder.percentOffset = 0; // bug workaround

var getRealtimeBars = function(company) {
  // only 5 sec is supported, only regular trading ours == false
  api.reqRealtimeBars(company.cancelId, company.contract, 5, 'TRADES', false);
};

var getMktData = function(company) {
  api.reqMktData(company.cancelId, company.contract, '', false);
};

var placeMyOrder = function(company, action, quantity, orderType, lmtPrice, auxPrice, entry, modify) {
  var oldId = -1;
  if (modify) {
    oldId = company.orderId;
  } else {
    oldId = company.orderId = orderId++;
    if (entry) {
      entryOrderIds[oldId] = company;
      actions[oldId] = action;
    }
  }
  newOrder.action = action;
  newOrder.totalQuantity = quantity;
  newOrder.orderType = orderType;
  newOrder.lmtPrice = lmtPrice;
  newOrder.auxPrice = auxPrice;
  api.placeOrder(oldId, company.contract, newOrder);
  console.log((modify ? 'Modifying' : 'Placing'), 'order for', company.symbol, newOrder, company.bid, company.ask);
};

// Here we specify the event handlers.
//  Please follow this guideline for event handlers:
//  1. Add handlers to listen to messages
//  2. Each handler must have be a function (message) signature
var handleValidOrderId = function(message) {
  var companies = createCompanies();
  orderId = message.orderId;
  console.log('next order Id is', orderId);
  api.reqAllOpenOrders();
  api.reqAutoOpenOrders(true);
  for (var i = companies.length; i--;) {
    var company = companies[i];
    getRealtimeBars(company);
    getMktData(company);
  }
};

var cancelPrevOrder = function(prevOrderId) {
  if (prevOrderId > -1) { // cannot cancel negative order id
    console.log('canceling order: %d', prevOrderId);
    setImmediate(api.cancelOrder.bind(api, prevOrderId));
  }
};

var modifyExpiry = function(company, oId, order) {
  cancelPrevOrder(oId);
  company.contract.expiry = company.newExpiry;
  placeMyOrder(company, order.action, order.totalQuantity, 'LMT', order.lmtPrice, 0.0, false, false);
};

var handleServerError = function(message) {
  console.log(Date(), '[ServerError]', message);
  if (message.errorCode === 1101 || message.errorCode === 1102 || message.errorCode === 1300) {
    process.exit(1);
  }
};

var handleClientError = function(message) {
  console.log(Date(), '[ClientError]', message);
  if (message.errorCode === 1101 || message.errorCode === 1102 || message.errorCode === 1300) {
    process.exit(1);
  }
};

var handleDisconnected = function(message) {
  console.log(Date(), '[Disconnected]', message);
  if (message.errorCode === 1101 || message.errorCode === 1102 || message.errorCode === 1300) {
    process.exit(1);
  }
};

var handleConnectionClosed = function(message) {
  console.log(Date(), '[ConnectionClosed]', message);
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
  var close = company.close;
  var open = company.open;
  var second = date.seconds();
  if (second <= 57 && second > 3) {
    if (second <= 7) {
      company.resetLowHigh();
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
  var bid = company.bid;
  var ask = company.ask;
  var mid = (bid + ask) / 2.0;
  var tradeController = company.tradeController;
  var minute = date.minutes();
  var hour = date.hours();
  var noPosition = (hour < 9) || (hour >= 15) || (minute < 21 && hour === 9) || (minute > 20 && hour === 14); // starts earlier than regular trading hours
  //var noPosition = (hour < 9) || (hour >= 12) || (minute < 21 && hour === 9) || (minute > 20 && hour === 11); // for thanksgiving and christmas
  var noSma = (hour < 11) || (minute < 38 && hour === 11);
  var action = tradeController.tradeLogic(mid, high, low, open, noPosition, noSma, true);
  company.resetLowHighCloseOpen();
  console.log(realtimeBar, bid, ask, mid, Date());
  var lLotsLength = company.lLotsLength;
  var sLotsLength = company.sLotsLength;
  var lengthDiff = lLotsLength - sLotsLength;
  var maxLot = company.maxLot;
  var hardLMaxPrices = company.hardLMaxPrices;
  var hardLMinPrices = company.hardLMinPrices;
  var hardSMinPrices = company.hardSMinPrices;
  var hardSMaxPrices = company.hardSMaxPrices;
  if (action === HOLD || (action === BUY && ((lLotsLength >= maxLot && lengthDiff > 1) || lLotsLength >= hardLMaxPrices.length)) || (action === SELL && ((sLotsLength >= maxLot && lengthDiff < 0) || sLotsLength >= hardSMinPrices.length))) {
    return;
  }
  var lmtPrice = action === BUY ? bid : ask;
  if (action === BUY ? (lmtPrice > hardLMaxPrices[lLotsLength] || lmtPrice < hardLMinPrices[lLotsLength]) : (lmtPrice < hardSMinPrices[sLotsLength] || lmtPrice > hardSMaxPrices[sLotsLength])) {
    console.log('[WARNING]', action, 'order ignored since the limit price is', lmtPrice, ', which is less/more than the threshold', hardLMaxPrices[lLotsLength], hardLMinPrices[lLotsLength], hardSMinPrices[sLotsLength], hardSMaxPrices[sLotsLength]);
    return;
  }
  var oldExpiryPosition = company.oldExpiryPosition;
  if (action === BUY ? (oldExpiryPosition < 0) : (oldExpiryPosition > 0)) {
    company.contract.expiry = company.oldExpiry;
  } else {
    company.contract.expiry = company.newExpiry;
  }
  placeMyOrder(company, action, company.onePosition, 'LMT', lmtPrice, 0.0, true, false);
};

var handleTickPrice = function(tickPrice) {
  var company = cancelIds[tickPrice.tickerId];
  var field = tickPrice.field;
  var price = tickPrice.price;
  if (company && price) {
    if (field === 4) { // last price
      company.low = min(price, company.low);
      company.high = max(price, company.high);
      company.close = price;
      company.open = company.open || price;
    } else {
      var action = actions[company.orderId];
      if (field === 1) { // bid price
        var bid = company.bid;
        company.bid = price;
        if (company.lastOrderStatus === 'Submitted' && action === SELL && bid > price) { // to aggresive mode
          placeMyOrder(company, action, company.onePosition, 'LMT', price, 0.0, false, true); // modify order
        }
      } else if (field === 2) { // ask price
        var ask = company.ask;
        company.ask = price;
        if (company.lastOrderStatus === 'Submitted' && action === BUY && ask < price) { // to aggresive mode
          placeMyOrder(company, action, company.onePosition, 'LMT', price, 0.0, false, true); // modify order
        }
      } else if (field === 9) { // last day close
        company.lastDayClose = price;
        console.log('last day close', price);
      }
    }
  }
};

var handleOrderStatus = function(message) {
  console.log('OrderStatus:', JSON.stringify(message));
  var oId = message.orderId;
  var orderStatus = message.status;
  var company = entryOrderIds[oId];
  if (company) {
    company.lastOrderStatus = orderStatus;
    if (orderStatus === 'Inactive') {
      cancelPrevOrder(oId);
    } else if (orderStatus === 'Filled') {
      entryOrderIds[oId] = null;
      var action = actions[oId] === BUY ? SELL : BUY;
      var lmtPrice = message.avgFillPrice * (action === SELL ? OFFSET_POS : OFFSET_NEG);
      var tickInverse = company.oneTickInverse;
      lmtPrice = round(lmtPrice * tickInverse) / tickInverse; // required to place a correct order
      var oldExpiry = company.oldExpiry;
      var newExpiry = company.newExpiry;
      if (oldExpiry !== newExpiry) {
        var exLot = company.getExLot();
        if (exLot) {
          modifyExpiry(company, exLot.oId, exLot.order);
        }
      }
      var oldExpiryPosition = company.oldExpiryPosition;
      if (action === BUY ? (oldExpiryPosition < 0) : (oldExpiryPosition > 0)) {
        company.contract.expiry = oldExpiry;
      } else {
        company.contract.expiry = newExpiry;
      }
      placeMyOrder(company, action, message.filled, 'LIT', lmtPrice, lmtPrice, false, false); // LIT order not to execute at bad price on open
    }
  }
};

var handleOpenOrder = function(message) {
  console.log('OpenOrder:', JSON.stringify(message));
  var oId = message.orderId;
  var orderStatus = message.orderState.status;
  var company = entryOrderIds[oId];
  if (company === undefined) { // if exiting the position
    var contract = message.contract;
    company = symbols[contract.symbol];
    if (company) {
      var order = message.order;
      var action = order.action;
      var expiry = contract.expiry;
      var oldExpiry = company.oldExpiry;
      var newExpiry = company.newExpiry;
      if (orderStatus === 'Filled' || orderStatus === 'Cancelled') {
        if (action === BUY) {
          if (company.sLots[oId]) {
            company.sLots[oId] = false;
            company.sLotsLength -= 1;
            if (newExpiry !== expiry) {
              company.oldExpiryPosition += 1;
              company.sExLots[oId] = null;
            }
          }
        } else if (action === SELL) {
          if (company.lLots[oId]) {
            company.lLots[oId] = false;
            company.lLotsLength -= 1;
            if (newExpiry !== expiry) {
              company.oldExpiryPosition -= 1;
              company.lExLots[oId] = null;
            }
          }
        }
        console.log('[Delete lots]', company.symbol, company.oldExpiryPosition, company.lLots, company.lLotsLength, company.sLots, company.sLotsLength);
      } else if (orderStatus !== 'Inactive') {
        var oldExpiryPosition = company.oldExpiryPosition;
        var exLot = null;
        if (oldExpiry === newExpiry && newExpiry !== expiry) { // right before expiry, aggresively roll
          modifyExpiry(company, oId, order);
          company.contract.expiry = expiry;
          var lmtPrice = action === BUY ? company.bid : company.ask;
          placeMyOrder(company, action, order.totalQuantity, 'LMT', lmtPrice, 0.0, true, false);
        } else if (action === BUY) {
          if (!company.sLots[oId]) {
            company.sLots[oId] = true;
            company.sLotsLength += 1;
            if (newExpiry !== expiry) {
              if (oldExpiryPosition > 0) {
                exLot = company.getExLot();
                if (exLot) {
                  modifyExpiry(company, exLot.oId, exLot.order);
                  modifyExpiry(company, oId, order);
                }
              } else {
                company.oldExpiryPosition -= 1;
                company.sExLots[oId] = order;
              }
            }
          }
        } else if (action === SELL) {
          if (!company.lLots[oId]) {
            company.lLots[oId] = true;
            company.lLotsLength += 1;
            if (newExpiry !== expiry) {
              if (oldExpiryPosition < 0) {
                exLot = company.getExLot();
                if (exLot) {
                  modifyExpiry(company, exLot.oId, exLot.order);
                  modifyExpiry(company, oId, order);
                }
              } else {
                company.oldExpiryPosition += 1;
                company.lExLots[oId] = order;
              }
            }
          }
        }
        console.log('[Append lots]', company.symbol, company.oldExpiryPosition, company.lLots, company.lLotsLength, company.sLots, company.sLotsLength);
      }
    }
  }
};

// After that, you must register the event handler with a messageId
// For list of valid messageIds, see messageIds.js file.
api.handlers[messageIds.nextValidId] = handleValidOrderId;
api.handlers[messageIds.error] = handleServerError;
api.handlers[messageIds.clientError] = handleClientError;
api.handlers[messageIds.disconnected] = handleDisconnected;
api.handlers[messageIds.connectionClosed] = handleConnectionClosed;
api.handlers[messageIds.realtimeBar] = handleRealTimeBar;
api.handlers[messageIds.tickPrice] = handleTickPrice;
api.handlers[messageIds.orderStatus] = handleOrderStatus;
api.handlers[messageIds.openOrder] = handleOpenOrder;

// Connect to the TWS client or IB Gateway
var connected = api.connect('127.0.0.1', 7496, 0);

// Once connected, start processing incoming and outgoing messages
if (connected) {
  api.beginProcessing();
} else {
  throw new Error('Failed connecting to localhost TWS/IB Gateway');
}
