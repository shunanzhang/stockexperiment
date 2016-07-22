var ibapi = require('ibapi');
var messageIds = ibapi.messageIds;
var Company = require('./company');

var createCompanies = function() {
  var companies = [new Company('ES')];
  return companies;
};

var api = new ibapi.NodeIbapi();

// Interactive Broker requires that you use orderId for every new order
//  inputted. The orderId is incremented everytime you submit an order.
//  Make sure you keep track of this.
var orderId = -1;

// Here we specify the event handlers.
//  Please follow this guideline for event handlers:
//  1. Add handlers to listen to messages
//  2. Each handler must have be a function (message) signature
var handleValidOrderId = function(message) {
  var companies = createCompanies();
  orderId = message.orderId;
  console.log('next order Id is', orderId);
  api.reqAllOpenOrders();
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

var handleOrderStatus = function(message) {
  console.log('OrderStatus:', JSON.stringify(message));
};

var handleOpenOrder = function(message) {
  console.log('OpenOrder:', JSON.stringify(message));
};

// After that, you must register the event handler with a messageId
// For list of valid messageIds, see messageIds.js file.
api.handlers[messageIds.nextValidId] = handleValidOrderId;
api.handlers[messageIds.error] = handleServerError;
api.handlers[messageIds.orderStatus] = handleOrderStatus;
api.handlers[messageIds.openOrder] = handleOpenOrder;

// Connect to the TWS client or IB Gateway
var connected = api.connect('127.0.0.1', 7496, 1);

// Once connected, start processing incoming and outgoing messages
if (connected) {
  api.beginProcessing();
} else {
  throw new Error('Failed connecting to localhost TWS/IB Gateway');
}
