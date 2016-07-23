var moment = require('moment-timezone');
var ibapi = require('ibapi');
var messageIds = ibapi.messageIds;
var TIMEZONE = require('./googleCSVReader').TIMEZONE;
var TradeController = require('./tradeController');
var Company = require('./company');

/**
 * argument parsing
 */
var tickerId = process.argv[2];
var action = process.argv[3];
var quantity = parseInt(process.argv[4], 10);
var orderType = process.argv[5];
var lmtPrice = parseFloat(process.argv[6]);
var auxPrice = parseFloat(process.argv[7]);

var createCompanies = function() {
  var companies = [new Company(tickerId)];
  return companies;
};

var api = new ibapi.NodeIbapi();

// Interactive Broker requires that you use orderId for every new order
//  inputted. The orderId is incremented everytime you submit an order.
//  Make sure you keep track of this.
var orderId = -1;

// Singleton order object
var newOrder = ibapi.order.createOrder();
newOrder.auxPrice = 0.0;
newOrder.hidden = false;
newOrder.tif = 'GTC';
newOrder.outsideRth = true;
newOrder.percentOffset = 0; // bug workaround

var placeMyOrder = function(company, action, quantity, orderType, lmtPrice, entry, modify) {
  var oldId = -1;
  if (modify) {
    oldId = company.orderId;
  } else {
    oldId = company.orderId = orderId++;
  }
  newOrder.action = action;
  newOrder.totalQuantity = quantity;
  newOrder.orderType = orderType;
  newOrder.lmtPrice = lmtPrice;
  api.placeOrder(oldId, company.contract, newOrder);
  console.log((modify ? 'Modifying' : 'Placing'), 'order for', company.symbol, newOrder, company.bid, company.ask);
};

var handleValidOrderId = function(message) {
  var companies = createCompanies();
  orderId = message.orderId;
  console.log('next order Id is', orderId);
  for (var i = companies.length; i--;) {
    var company = companies[i];
    placeMyOrder(company, action, quantity, orderType, lmtPrice, true, false);
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

// After that, you must register the event handler with a messageId
// For list of valid messageIds, see messageIds.js file.
api.handlers[messageIds.nextValidId] = handleValidOrderId;
api.handlers[messageIds.error] = handleServerError;

// Connect to the TWS client or IB Gateway
var connected = api.connect('127.0.0.1', 7496, 0);

// Once connected, start processing incoming and outgoing messages
if (connected) {
  api.beginProcessing();
} else {
  throw new Error('Failed connecting to localhost TWS/IB Gateway');
}
