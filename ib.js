var ibapi = require('ibapi');
var messageIds = ibapi.messageIds;
var contract = ibapi.contract;
var order = ibapi.order;

var REALTIME_INTERVAL = 5; // only 5 sec is supported, only regular trading ours == true

var api = new ibapi.NodeIbapi();
var orderId = -1;

var buildContract = function(tickerId, exchange) {
  var _contract = contract.createContract();
  _contract.symbol = tickerId;
  _contract.secType = 'STK';
  _contract.exchange = 'SMART';
  _contract.primaryExchange = exchange;
  _contract.currency = 'USD';
  return _contract;
};

var addTicker = function(_contract, cancelId) {
  api.reqRealtimeBars(cancelId, _contract, REALTIME_INTERVAL, 'TRADES', true);
};

var placeThatOrder = function(_contract, quantity) {
  console.log('Next valid order Id: %d', orderId);
  console.log('Placing order for', _contract.symbol);
  var oldId = orderId;
  orderId = orderId + 1;
  setImmediate(api.placeSimpleOrder.bind(api, oldId, _contract, 'BUY', quantity, 'LMT', 0.11, 0.11));
};

var handleValidOrderId = function(message) {
  orderId = message.orderId;
  console.log('next order Id is', orderId);
  var _contract = buildContract('NFLX', 'NASDAQ');
  addTicker(_contract, 1);
  placeThatOrder(_contract, 1000);
};

var cancelPrevOrder = function(prevOrderId) {
  console.log('canceling order: %d', prevOrderId);
  setImmediate(api.cancelOrder.bind(api, prevOrderId));
};

var handleServerError = function(message) {
  console.log('Error:', message.id.toString(), '-', message.errorCode.toString(), '-', message.errorString.toString());
};

var handleClientError = function(message) {
  console.log('clientError');
  console.log(JSON.stringify(message));
};

var handleDisconnected = function(message) {
  console.log('disconnected');
  process.exit(1);
};

var handleRealTimeBar = function(realtimeBar) {
  console.log( 'RealtimeBar:', realtimeBar.reqId.toString(), realtimeBar.time.toString(), realtimeBar.open.toString(), realtimeBar.high.toString(), realtimeBar.low.toString(), realtimeBar.close.toString(), realtimeBar.volume.toString(), realtimeBar.wap.toString(), realtimeBar.count.toString());
};

var handleOrderStatus = function(message) {
  console.log('OrderStatus: ');
  console.log(JSON.stringify(message));
  if (message.status === 'PreSubmitted' || message.status === 'Inactive') {
    cancelPrevOrder(message.orderId);
    setTimeout(placeThatOrder, 1000);
  }
};

var handleOpenOrder = function(message) {
  console.log('OpenOrder: ');
  console.log(JSON.stringify(message));
};

var handleOpenOrderEnd = function(message) {
  console.log('OpenOrderEnd: ');
  console.log(JSON.stringify(message));
};


// After that, you must register the event handler with a messageId
//  For list of valid messageIds, see messageIds.js file.
api.handlers[messageIds.nextValidId] = handleValidOrderId;
api.handlers[messageIds.svrError] = handleServerError;
api.handlers[messageIds.clientError] = handleClientError;
api.handlers[messageIds.disconnected] = handleDisconnected;
api.handlers[messageIds.realtimeBar] = handleRealTimeBar;
api.handlers[messageIds.orderStatus] = handleOrderStatus;
api.handlers[messageIds.openOrder] = handleOpenOrder;
api.handlers[messageIds.openOrderEnd] = handleOpenOrderEnd;

// Connect to the TWS client or IB Gateway
var connected = api.connect('127.0.0.1', 7496, 0);

// Once connected, start processing incoming and outgoing messages
if (connected) {
  api.beginProcessing();
}
