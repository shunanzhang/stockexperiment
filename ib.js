var ibapi = require('ibapi');
var messageIds = ibapi.messageIds;
var contract = ibapi.contract;
var order = ibapi.order;
var GoogleCSVReader = require('./googleCSVReader');
var CLOSE_COLUMN = GoogleCSVReader.CLOSE_COLUMN;
var TradeController = require('./tradeController');
var BUY = TradeController.BUY;
var SELL = TradeController.SELL;
var MINUTES_DAY = TradeController.MINUTES_DAY;
var TRAIN_INTERVAL = TradeController.TRAIN_INTERVAL;
var TRAIN_LEN = TradeController.TRAIN_LEN;

var REALTIME_INTERVAL = 5; // only 5 sec is supported, only regular trading ours == true

/**
 * argument parsing
 */
var symbol = process.argv[2] || 'NFLX';
var googleCSVReader = new GoogleCSVReader(symbol);

var api = new ibapi.NodeIbapi();
var tradeController;

// Interactive Broker requires that you use orderId for every new order
//  inputted. The orderId is incremented everytime you submit an order.
//  Make sure you keep track of this.
var orderId = -1;

var buildContract = function(symbol, exchange) {
  var _contract = contract.createContract();
  _contract.symbol = symbol;
  _contract.secType = 'STK';
  _contract.exchange = 'SMART';
  _contract.primaryExchange = exchange;
  _contract.currency = 'USD';
  return _contract;
};
var NFLXcontract = buildContract('NFLX', 'NASDAQ');

var getRealtimeBars = function(_contract, cancelId) {
  api.reqRealtimeBars(cancelId, _contract, REALTIME_INTERVAL, 'TRADES', true);
};

var placeLimitOrder = function(_contract, quantity, price) {
  console.log('Next valid order Id: %d', orderId);
  console.log('Placing order for', _contract.symbol);
  var oldId = orderId++;
  setImmediate(api.placeSimpleOrder.bind(api, oldId, _contract, 'BUY', quantity, 'LMT', price, price)); // last parameter is auxPrice, should it be 0?
};

// Here we specify the event handlers.
//  Please follow this guideline for event handlers:
//  1. Add handlers to listen to messages
//  2. Each handler must have be a function (message) signature
var handleValidOrderId = function(message) {
  orderId = message.orderId;
  console.log('next order Id is', orderId);
  getRealtimeBars(NFLXcontract, 1);
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

  var second = realtimeBar.time % 60;
  if (second <= 57 && second > 3) {
    return; // skip if it is not the end of minutes
  }
  var featureVector = tradeController.getFeatureVectorFromRaltimeBar(realtimeBar);
  var minute = (realtimeBar.time / 60 | 0);
  var forceSell = (minute % MINUTES_DAY >= MINUTES_DAY - 10);
  result = tradeController.trade(featureVector, forceSell); // always sell a the end of the day

  // wrte trade logic here
  placeLimitOrder(NFLXcontract, 100, 100);
};

var handleOrderStatus = function(message) {
  console.log('OrderStatus: ');
  console.log(JSON.stringify(message));
  if (message.status === 'PreSubmitted' || message.status === 'Inactive') {
    cancelPrevOrder(message.orderId);
    setTimeout(placeLimitOrderi, NFLXcontract, 100, 100);
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

var warmupTrain = function () {
  var data = googleCSVReader.data;
  var dataLen = data.length;
  var closes = googleCSVReader.getColumnData(CLOSE_COLUMN);
  tradeController = new TradeController(googleCSVReader.columns, closes);
  tradeController.supervise(TRAIN_LEN - 1);

  for (var i = 0; i < dataLen; i++) {
    var datum = data[i];
    var featureVector = tradeController.getFeatureVector(datum);
    var isTraining = (i % TRAIN_INTERVAL === TRAIN_INTERVAL - 1) || (i === dataLen - 1);
    if (i >= TRAIN_LEN && isTraining) {
      tradeController.supervise(i);
    }
    tradeController.train(i, featureVector);
  }

  googleCSVReader.shutdown();
};

var setup = function() {
  warmupTrain();
  // Once connected, start processing incoming and outgoing messages
  if (connected) {
    api.beginProcessing();
  } else {
    throw new Error('Failed connecting to localhost TWS/IB Gateway');
 }
};

googleCSVReader.load(setup);
