var moment = require('moment-timezone');
var ibapi = require('ibapi');
var messageIds = ibapi.messageIds;
var contract = ibapi.contract;
var order = ibapi.order;
var GoogleCSVReader = require('./googleCSVReader');
var TIMEZONE = GoogleCSVReader.TIMEZONE;
var TradeController = require('./tradeController');
var BUY = TradeController.BUY;
var SELL = TradeController.SELL;
var HOLD = TradeController.HOLD;
var MINUTES_DAY = TradeController.MINUTES_DAY;

var REALTIME_INTERVAL = 5; // only 5 sec is supported, only regular trading ours == true
var MAX_POSITION = 100;

var MAX_INT = 0x7FFFFFFF; // max 31 bit
var MIN_INT = -0x7FFFFFFE; // negative max 31 bit

/**
 * argument parsing
 */
var symbol = process.argv[2] || 'NFLX';
var exchange = process.argv[3] || 'NASDAQ';
var googleCSVReader = new GoogleCSVReader(symbol);
var minSellPrice = process.argv[4] || 65.00; // for flash crash

var api = new ibapi.NodeIbapi();
var tradeController;
var position = 0;
var abs = Math.abs;
var max = Math.max;
var min = Math.min;
var low = MAX_INT;
var high = MIN_INT;
var open = 0.0;
var close = 0.0;

// Interactive Broker requires that you use orderId for every new order
//  inputted. The orderId is incremented everytime you submit an order.
//  Make sure you keep track of this.
var orderId = -1;

var lastOrderStatus = 'Filled';

var buildContract = function(symbl, exchange, route) {
  var _contract = contract.createContract();
  _contract.symbol = symbl;
  _contract.secType = 'STK';
  _contract.exchange = route || 'SMART';
  _contract.primaryExchange = exchange;
  _contract.currency = 'USD';
  return _contract;
};
var smartContract = buildContract(symbol, exchange);

var getRealtimeBars = function(_contract, cancelId) {
  api.reqRealtimeBars(cancelId, _contract, REALTIME_INTERVAL, 'TRADES', true);
};

var getMktData = function(_contract, cancelId) {
  api.reqMktData(cancelId, _contract, '', false);
};

var placeMyOrder = function(_contract, action, quantity, orderType, lmtPrice, auxPrice) {
  var oldId = orderId++;
  var newOrder = order.createOrder();
  newOrder.action = action;
  newOrder.totalQuantity = quantity;
  newOrder.orderType = orderType;
  newOrder.lmtPrice = lmtPrice;
  newOrder.auxPrice = auxPrice;
  newOrder.hidden = true;
  setImmediate(api.placeOrder.bind(api, oldId, _contract, newOrder));
  console.log('Next valid order Id: %d', oldId);
  console.log('Placing order for', _contract.symbol);
  console.log(action, quantity);
};

// Here we specify the event handlers.
//  Please follow this guideline for event handlers:
//  1. Add handlers to listen to messages
//  2. Each handler must have be a function (message) signature
var handleValidOrderId = function(message) {
  orderId = message.orderId;
  console.log('next order Id is', orderId);
  api.reqPositions();
  getRealtimeBars(smartContract, 1);
  getMktData(smartContract, 1);
};

var cancelPrevOrder = function(prevOrderId) {
  setImmediate(api.cancelOrder.bind(api, prevOrderId));
  console.log('canceling order: %d', prevOrderId);
};

var handleServerError = function(message) {
  console.log('Error:', message.id.toString(), '-', message.errorCode.toString(), '-', message.errorString.toString());
};

var handleClientError = function(message) {
  console.log('clientError');
  console.log(JSON.stringify(message));
};

var handleDisconnected = function(message) {
  //console.log('disconnected');
};

var handleRealTimeBar = function(realtimeBar) {
  var date = moment.tz((realtimeBar.timeLong + 5) * 1000, TIMEZONE); // realtimebar time has 5 sec delay, fastforward 5 sec
  low = min(realtimeBar.low, low);
  high = max(realtimeBar.high, high);
  open = open || realtimeBar.open;
  close = close || realtimeBar.close;
  var second = date.seconds();
  if (second <= 57 && second > 3) {
    if (second <= 7) {
      low = MAX_INT;
      high = MIN_INT;
      open = 0.0;
      close = 0.0;
    } else if (second > 52 && lastOrderStatus !== 'Filled') {
      cancelPrevOrder(orderId - 1);
    }
    return; // skip if it is not the end of minutes
  }
  realtimeBar.low = low;
  realtimeBar.high = high;
  realtimeBar.close = close;
  realtimeBar.open = open;
  var featureVector = tradeController.getFeatureVectorFromRaltimeBar(realtimeBar);
  low = MAX_INT;
  high = MIN_INT;
  close = 0.0;
  open = 0.0;
  var minute = date.minutes();
  var hour = date.hours();
  // always sell a the end of the day
  //var noPosition = (hour < 9) || (hour >= 16) || (minute < 50 && hour === 9) || (minute > 56 && hour === 15);
  var noPosition = (hour < 9) || (hour >= 13) || (minute < 50 && hour === 9) || (minute > 56 && hour === 12); // for thanksgiving and christmas
  var result = tradeController.trade(featureVector, noPosition);

  // check if there are shares to sell / money to buy fisrt
  var qty = abs(position);
  if (result === HOLD && position < 0) {
    result = BUY;
  } else if (result === HOLD && position > 0) {
    result = SELL;
  } else if ((result === BUY && position < 0) || (result === SELL && position > 0)) {
    qty += MAX_POSITION;
  } else if ((result === BUY || result === SELL) && MAX_POSITION > qty) {
    qty = MAX_POSITION - qty;
  } else {
    return;
  }
  if (close < minSellPrice) {
    console.log('order ignored since the limit price is', close, ', which is less than the threshold', minSellPrice);
    return;
  }
  var orderType = (noPosition || qty < MAX_POSITION) ? 'MKT' : 'REL';
  var limitPrice = close + (result === BUY ? 0.16 : -0.16);
  placeMyOrder(smartContract, result.toUpperCase(), qty, orderType, limitPrice, 0.04);
  console.log(result, noPosition, position, realtimeBar);
};

var handleTickPrice = function(tickPrice) {
  var field = tickPrice.field;
  var price = tickPrice.price;
  if (field === 6) { // high
    high = max(price, high);
  } else if (field === 7) { // low
    low = min(price, low);
  } else if (field === 9) { // close
    close = price;
  }
};

var handleOrderStatus = function(message) {
  console.log('OrderStatus: ');
  console.log(JSON.stringify(message));
  if (message.status === 'PreSubmitted' || message.status === 'Inactive') {
    cancelPrevOrder(message.orderId);
  }
  lastOrderStatus = message.status;
};

var handlePosition = function(message) {
  console.log('Position: ');
  console.log(JSON.stringify(message));
  if (message.contract && message.contract.symbol === symbol) {
    position = message.position;
  }
};

// After that, you must register the event handler with a messageId
// For list of valid messageIds, see messageIds.js file.
api.handlers[messageIds.nextValidId] = handleValidOrderId;
api.handlers[messageIds.svrError] = handleServerError;
api.handlers[messageIds.clientError] = handleClientError;
api.handlers[messageIds.disconnected] = handleDisconnected;
api.handlers[messageIds.realtimeBar] = handleRealTimeBar;
api.handlers[messageIds.tickPrice] = handleTickPrice;
api.handlers[messageIds.orderStatus] = handleOrderStatus;
api.handlers[messageIds.position] = handlePosition;

// Connect to the TWS client or IB Gateway
var connected = api.connect('127.0.0.1', 7496, 0);

var warmupTrain = function () {
  var data = googleCSVReader.data;
  var dataLen = data.length;
  tradeController = new TradeController(googleCSVReader.columns);
  for (var i = 0; i < dataLen; i++) {
    tradeController.getFeatureVector(data[i]);
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
