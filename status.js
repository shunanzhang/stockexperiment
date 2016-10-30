var Company = require('./company');
var log = console.log;

var companies = [new Company('ES')];

var orderId = -1;

var handleValidOrderId = function(orderId) {
  log('next order Id is', orderId);
  ibClient.reqAllOpenOrders();
};

var handleServerError = function(id, errorCode, errorString) {
  if (errorCode === 2109) { // ignore
    return;
  }
  log(Date(), '[ServerError]', id, errorCode, errorString);
  if (errorCode === 1101 || errorCode === 1102 || errorCode === 1300) {
    process.exit(1);
  }
};

var handleOrderStatus = function(oId, orderStatus, filled, remaining, avgFillPrice, permId, parentId, lastFillPrice, clientId, whyHeld) {
  log('OrderStatus:', oId, orderStatus, filled, remaining, avgFillPrice, permId, parentId, lastFillPrice, clientId, whyHeld);
};

var handleOpenOrder = function(oId, symbol, expiry, action, totalQuantity, orderType, lmtPrice, orderStatus) {
  log('OpenOrder:', oId, symbol, expiry, action, totalQuantity, orderType, lmtPrice, orderStatus);
};

var handleTickPrice = function() {};
var handleRealTimeBar = function() {};
var handleConnectionClosed = function() {};

var ibClient = new IbClient(companies, handleOrderStatus, handleValidOrderId, handleServerError, handleTickPrice, handleOpenOrder, handleRealTimeBar, handleConnectionClosed);

// Connect to the TWS client or IB Gateway
var connected = ibClient.connect('127.0.0.1', 7496, 1);

// Once connected, start processing incoming and outgoing messages
if (connected) {
  var processMessage = function() {
    ibClient.processMessages();
    setImmediate(processMessage); // faster but 100% cpu
    //setTimeout(processMessage, 0); // slower but less cpu intensive
  };
  setImmediate(processMessage);
} else {
  throw new Error('Failed connecting to localhost TWS/IB Gateway');
}
