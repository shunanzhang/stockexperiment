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
  }
};

var cancelPrevOrder = function(prevOrderId) {
  if (prevOrderId > 0) { // cannot cancel negative order id or zero
    apiClient.cancelOrder(prevOrderId); // avoid rate limitter
    console.log('canceling order: %d', prevOrderId);
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

var handleTickPrice = function(tickPrice) {
  var company = cancelIds[tickPrice.tickerId];
  var field = tickPrice.field;
  var price = tickPrice.price;
  var canAutoExecute = tickPrice.canAutoExecute;
  if (company && price && price > 0.0) {
    var key = -1;
    var order;
    var i = 0;
    var bid = company.bid;
    var ask = company.ask;
    if (field === 1 && canAutoExecute) { // bid price
      company.bid = price;
      //if (bid < price && bid) {
      //  var lLots = company.lLots;
      //  var lLotKeys = Object.keys(lLots);
      //  for (i = lLotKeys.length; i--;) {
      //    key = parseInt(lLotKeys[i], 10);
      //    if (key < ignoreOrderId) {
      //      continue;
      //    }
      //    order = lLots[key];
      //    placeMyOrder(company, order.action, order.totalQuantity, 'LMT', price, key); // modify order
      //  }
      //}
      company.oldExpiryPosition = 0;
    } else if (field === 2 && canAutoExecute) { // ask price
      company.ask = price;
      //if (ask > price && ask) {
      //  var sLots = company.sLots;
      //  var sLotKeys = Object.keys(sLots);
      //  for (i = sLotKeys.length; i--;) {
      //    key = parseInt(sLotKeys[i], 10);
      //    if (key < ignoreOrderId) {
      //      continue;
      //    }
      //    order = sLots[key];
      //    placeMyOrder(company, order.action, order.totalQuantity, 'LMT', price, key); // modify order
      //  }
      //}
      company.oldExpiryPosition = 0;
    } else if (field === 4) { // last price
      var within = company.oldExpiryPosition; // TODO rename oldExpiryPosition to something more appropriate
      if (bid <= price && price <= ask && (ask - bid) * company.oneTickInverse === 1.0) {
        if (++within > 3) {
          if (process.argv[2]) {
            kick(company);
          } else {
            console.log('kick', Date.now());
          }
          within = 0;
        }
      } else {
        within = 0;
      }
      company.oldExpiryPosition = within;
    } else if (field === 9) { // last day close
      company.setCaps(price);
      console.log('last day close', price, company);
    }
  }
  console.log('tickPrice:', JSON.stringify(tickPrice));
};

// for debugging
var limit = 100;
var count = 0;
var maxLot = 2;

var maxLotControl = function() {
  var date = moment.tz(TIMEZONE);
  var minute = date.minutes();
  var hour = date.hours();
  if (hour < 10 || (hour === 10 && minute < 31)) {
    maxLot = 3;
  } else if (hour < 12 || hour > 14) {
    maxLot = 2;
  } else {
    maxLot = 1;
  }
};
//maxLotControl();
//setInterval(maxLotControl, 60 * 1000);

var handleOpenOrder = function(message) {
  var oId = message.orderId;
  if (oId < ignoreOrderId) {
    return;
  }
  var orderStatus = message.orderState.status;
  var symbol = message.contract.symbol;
  var company = symbols[symbol];
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
      console.log('[Delete lots]', symbol, lLotsLength, sLotsLength);
    } else {
      if (action === SELL) {
        sLots[oId] = order;
      } else if (action === BUY) {
        lLots[oId] = order;
      }
      console.log('[Append lots]', symbol, lLotsLength, sLotsLength);
    }
    company.lLotsLength = lLotsLength;
    company.sLotsLength = sLotsLength;
  }
  console.log('OpenOrder:', JSON.stringify(message));
};

var kick = function(company) {
  var sLots = company.sLots;
  var lLots = company.lLots;
  var lLotsLength = company.lLotsLength;
  var sLotsLength = company.sLotsLength;
  var bid = company.bid;
  var ask = company.ask;
  var hardLMaxPrice = company.hardLMaxPrices[0];
  var hardSMinPrice = company.hardSMinPrices[0];
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
    var msgCount = 0;
    var processMessage = function() {
      apiClient.checkMessages();
      apiClient.processMsg();
      var msg = apiClient.getInboundMsg();
      var messageId = msg.messageId;
      if (messageId) {
        var handler = handlers[messageId];
        while (!handler) {
          msg = apiClient.getInboundMsg();
          messageId = msg.messageId;
          if (messageId) {
            handler = handlers[messageId];
          } else {
            setImmediate(processMessage);
            return;
          }
        }
        handler(msg);
        setImmediate(processMessage); // faster but 100% cpu
      } else if(msgCount++ === 200) {
        setTimeout(processMessage, 0); // slower but less cpu intensive
        msgCount = 0;
      } else {
        setImmediate(processMessage);
      }
    };
    setImmediate(processMessage);
    api.isProcessing = true;
  }
} else {
  throw new Error('Failed connecting to localhost TWS/IB Gateway');
}
