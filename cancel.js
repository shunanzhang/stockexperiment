var moment = require('./momenttz');
var Addon = require('./build/Release/addon');
var IbClient = Addon.IbClient;
var log = console.log;

var hourOffset = moment.tz(moment.TIMEZONE).utcOffset() / 60;

var handleValidOrderId = function(orderId) {
  if (process.argv[4]) {
    cancelPrevOrder(parseInt(process.argv[3], 10));
  }
};

var cancelPrevOrder = function(prevOrderId) {
  if (prevOrderId > 0) { // cannot cancel negative order id or zero
    log('canceling order: %d', prevOrderId);
    ibClient.cancelOrder(prevOrderId); // avoid rate limitter
  }
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

var handleConnectionClosed = function() {
  log(Date(), '[ConnectionClosed]');
  process.exit(1);
};

var handleOpenOrder = function(oId, symbol, expiry, action, totalQuantity, orderType, lmtPrice, orderStatus) {
  log('OpenOrder:', oId, symbol, expiry, action, totalQuantity, orderType, lmtPrice, orderStatus);
};

var handleOrderStatus = function() {};
var handleTickPrice = function() {};
var handleRealTimeBar = function() {};
var handlePosition = function() {};

var ibClient = new IbClient([], hourOffset, handleOrderStatus, handleValidOrderId, handleServerError, handleTickPrice, handleOpenOrder, handleRealTimeBar, handleConnectionClosed, handlePosition);

// Connect to the TWS client or IB Gateway
var connected = ibClient.connect('127.0.0.1', 7496, parseInt(process.argv[2], 10));

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
