var moment = require('./momenttz');
var Addon = require('./build/Release/addon');
var IbClient = Addon.IbClient;
var Company = require('./company');
var log = console.log;

/**
 * argument parsing
 */
var tickerId = process.argv[2];
var action = process.argv[3];
var quantity = parseInt(process.argv[4], 10);
var orderType = process.argv[5];
var lmtPrice = parseFloat(process.argv[6]);
var auxPrice = parseFloat(process.argv[7]);

var hourOffset = moment.tz(moment.TIMEZONE).utcOffset() / 60;

var companies = [new Company(tickerId)];

var orderId = parseInt(process.argv[8], 10) || -1;

var placeMyOrder = function(company, action, quantity, orderType, lmtPrice, entry, modify) {
  var oldId = -1;
  if (modify) {
    oldId = company.orderId;
  } else {
    oldId = company.orderId = orderId++;
  }
  ibClient.placeOrder(oldId, company.cancelId, action, quantity, orderType, lmtPrice, company.expiry);
  log((modify ? 'Modifying' : 'Placing'), 'order for', company.symbol, company.bid, company.ask, company.tickTime);
};

var handleValidOrderId = function(messageOrderId) {
  if (!orderId || orderId < 0) {
    orderId = messageOrderId;
  }
  log('next order Id is', orderId);
  for (var i = companies.length; i--;) {
    var company = companies[i];
    placeMyOrder(company, action, quantity, orderType, lmtPrice, true, false);
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

var handleOrderStatus = function() {};
var handleTickPrice = function() {};
var handleOpenOrder = function() {};
var handleRealTimeBar = function() {};
var handleConnectionClosed = function() {};
var handlePosition = function() {};

var ibClient = new IbClient(companies, hourOffset, handleOrderStatus, handleValidOrderId, handleServerError, handleTickPrice, handleOpenOrder, handleRealTimeBar, handleConnectionClosed, handlePosition);

// Connect to the TWS client or IB Gateway
var connected = ibClient.connect('127.0.0.1', 7496, (process.argv[9] === undefined) ? 1 : parseInt(process.argv[9], 10));

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
