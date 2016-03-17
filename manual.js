var ibapi = require('ibapi');
var messageIds = ibapi.messageIds;
var createOrder = ibapi.order.createOrder;
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

var abs = Math.abs;

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
  newOrder.tif = 'GTC';
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

var takePosition = function(company) {
  if (!company) {
    console.log('[WARNING] Unknown company', company);
    return;
  }
  var result = HOLD;
  var last = company.last;
  if (company.positioning || !last || abs(company.position) > company.maxPosition) {
    return;
  }
  company.positioning = true;
  if (company.command === L) {
    result = BUY;
  } else if (company.command === S) {
    result = SELL;
  } else {
    console.log('[WARNING] Unknown command', company.command);
    return;
  }

  // check if there are shares to sell / money to buy fisrt
  var qty = company.onePosition;
  var limitPrice = last + last * (result === BUY ? FIRST_OFFSET : -FIRST_OFFSET);
  if (limitPrice < company.minPrice) {
    console.log('[WARNING] order ignored since the limit price is', limitPrice, ', which is less than the threshold', company.minPrice);
    return;
  }
  var orderType = 'REL';
  placeMyOrder(company, result.toUpperCase(), qty, orderType, limitPrice, 0.01);
  limitPrice = last + last * (result === BUY ? SECOND_OFFSET : -SECOND_OFFSET);
  if (result === BUY) {
    result = SELL;
  } else if (result === SELL) {
    result = BUY;
  } else {
    return;
  }
  placeMyOrder(company, result.toUpperCase(), qty, orderType, limitPrice, 0.01);
};

var handleTickPrice = function(tickPrice) {
  var company = cancelIds[tickPrice.tickerId];
  var field = tickPrice.field;
  var price = tickPrice.price;
  if (field === 4 && company) { // last price
    company.last = price;
    takePosition(company);
  }
};

var handleOrderStatus = function(message) {
  console.log('OrderStatus:', JSON.stringify(message));
  if (message.status === 'Inactive') {
    cancelPrevOrder(message.orderId);
  }
  var company = orderIds[message.orderId];
  if (company && message.status === 'Filled') {
    console.log('Done');
    process.exit();
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
