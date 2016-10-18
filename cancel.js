var ibapi = require('ibapi');
var messageIds = ibapi.messageIds;
var Company = require('./company');

var api = new ibapi.NodeIbapi();
var apiClient = api.client;

// Here we specify the event handlers.
//  Please follow this guideline for event handlers:
//  1. Add handlers to listen to messages
//  2. Each handler must have be a function (message) signature
var handleValidOrderId = function(message) {
  if (process.argv[4]) {
    cancelPrevOrder(parseInt(process.argv[3], 10));
  }
};

var cancelPrevOrder = function(prevOrderId) {
  if (prevOrderId > 0) { // cannot cancel negative order id or zero
    console.log('canceling order: %d', prevOrderId);
    apiClient.cancelOrder(prevOrderId); // avoid rate limitter
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

var handleOpenOrder = function(message) {
  console.log('OpenOrder:', JSON.stringify(message));
};

// After that, you must register the event handler with a messageId
// For list of valid messageIds, see messageIds.js file.
var handlers = api.handlers;
handlers[messageIds.nextValidId] = handleValidOrderId;
handlers[messageIds.error] = handleServerError;
handlers[messageIds.connectionClosed] = handleConnectionClosed;
handlers[messageIds.openOrder] = handleOpenOrder;

// Connect to the TWS client or IB Gateway
var connected = api.connect('127.0.0.1', 7496, parseInt(process.argv[2], 10));

// Once connected, start processing incoming and outgoing messages
if (connected) {
  if (!api.isProcessing) {
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
      } else {
        setTimeout(processMessage, 0); // slower but less cpu intensive
      }
    };
    setImmediate(processMessage);
    api.isProcessing = true;
  }
} else {
  throw new Error('Failed connecting to localhost TWS/IB Gateway');
}
