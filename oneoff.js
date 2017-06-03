var moment = require('./momenttz');
var Addon = require('./build/Release/addon');
var TradeController = Addon.TradeController;
var IbClient = Addon.IbClient;
var BUY = TradeController.BUY;
var SELL = TradeController.SELL;
var OFFSET_POS = TradeController.OFFSET_POS;
var OFFSET_NEG = TradeController.OFFSET_NEG;
var Company = require('./company');
var round = Math.round;
var now = Date.now;
var log = console.log;

var cancelIds = {};
var entryOrderIds = {};
var actions = {};

/**
 * argument parsing
 */
var tickerId = process.argv[2];
var actionI = process.argv[3];
var quantity = parseInt(process.argv[4], 10);
var clientId = (process.argv[5] === undefined) ? 1 : parseInt(process.argv[5], 10);
var orderPlaced = false;

var hourOffset = moment.tz(moment.TIMEZONE).utcOffset() / 60;

var companies = [new Company(tickerId)];

// Interactive Broker requires that you use orderId for every new order
// inputted. The orderId is incremented everytime you submit an order.
// Make sure you keep track of this.
var orderId = -1;

var placeMyOrder = function(company, action, quantity, orderType, lmtPrice, entry, modify) {
  var oldId = -1;
  if (modify) {
    oldId = company.orderId;
  } else {
    oldId = company.orderId = orderId++;
    if (entry) {
      entryOrderIds[oldId] = company;
      actions[oldId] = action;
    }
  }
  ibClient.placeOrder(oldId, company.cancelId, action, quantity, orderType, lmtPrice, company.expiry);
  log((modify ? 'Modifying' : 'Placing'), 'order for', company.symbol, action, quantity, orderType, lmtPrice, company.expiry, company.tickTime);
};

var handleValidOrderId = function(oId) {
  var company;
  for (var i = companies.length; i--;) {
    company = companies[i];
    cancelIds[company.cancelId] = company;
  }
  orderId = oId;
  log('next order Id is', oId);
  for (i = companies.length; i--;) {
    company = companies[i];
    ibClient.reqMktData(company.cancelId, '', false);
  }
};

var cancelPrevOrder = function(prevOrderId) {
  if (prevOrderId > 0) { // cannot cancel negative order id or zero
    ibClient.cancelOrder(prevOrderId); // avoid rate limitter
    log('canceling order:', prevOrderId);
  }
};

var handleServerError = function(id, errorCode, errorString) {
  if (errorCode === 2109) { // ignore
    return;
  }
  log(Date(), '[ServerError]', id, errorCode, errorString);
  if (errorCode === 1101 || errorCode === 1300) {
    process.exit(1);
  }
};

var handleConnectionClosed = function() {
  log(Date(), '[ConnectionClosed]');
  process.exit(1);
};

var handleRealTimeBar = function() {};

var handleTickPrice = function(tickerId, field, price, canAutoExecute) {
  var company = cancelIds[tickerId];
  if (company && price) {
    if (field === 9) { // last day close
      if (company.lastDayLock) {
        // last day close might happen multiple times in a day in case of connection errors
        return;
      }
      company.lastDayLock = true;
      log(company.symbol, 'last day close', price);
    } else if (canAutoExecute) {
      var action = actions[company.orderId];
      var prevTickTime = company.tickTime + 1699;
      var tickTime = 1478840331260; // some init time in msec
      if (field === 1) { // bid price
        var bid = company.bid;
        company.bid = price;
        if (company.lastOrderStatus === 'Submitted' && action === BUY && bid < price && bid) {
          tickTime = now();
          if (tickTime > prevTickTime) { // wait more than 2 sec
            placeMyOrder(company, action, company.onePosition, 'LMT', price, false, true); // modify order
            company.tickTime = tickTime;
          }
        } else if (!orderPlaced && actionI === BUY) {
          orderPlaced = true;
          placeMyOrder(company, actionI, quantity, 'LMT', price, true, false);
        }
      } else if (field === 2) { // ask price
        var ask = company.ask;
        company.ask = price;
        if (company.lastOrderStatus === 'Submitted' && action === SELL && ask > price && ask) {
          tickTime = now();
          if (tickTime > prevTickTime) { // wait more than 2 sec
            placeMyOrder(company, action, company.onePosition, 'LMT', price, false, true); // modify order
            company.tickTime = tickTime;
          }
        } else if (!orderPlaced && actionI === SELL) {
          orderPlaced = true;
          placeMyOrder(company, actionI, quantity, 'LMT', price, true, false);
        }
      }
    }
  }
};

var handleOrderStatus = function(oId, orderStatus, filled, remaining, avgFillPrice, permId, parentId, lastFillPrice, clientId, whyHeld) {
  var company = entryOrderIds[oId];
  if (company) {
    company.lastOrderStatus = orderStatus;
    if (orderStatus === 'Inactive') {
      cancelPrevOrder(oId);
    } else if (orderStatus === 'Filled') {
      entryOrderIds[oId] = null;
      var isSell = actions[oId] === BUY;
      var action = isSell ? SELL : BUY;
      var lmtPrice = avgFillPrice * (isSell ? OFFSET_POS : OFFSET_NEG);
      var tickInverse = company.oneTickInverse;
      lmtPrice = round(lmtPrice * tickInverse) / tickInverse; // required to place a correct order
      if (isSell) {
        if (company.ask > lmtPrice) { // this condition becomes true usually for rolling
          lmtPrice = company.ask; // cannot sell at too low lmtPrice, the order gets rejected otherwise
        }
      } else {
        if (company.bid < lmtPrice) { // this condition becomes true usually for rolling
          lmtPrice = company.bid; // cannot buy at too high lmtPrice, the order gets rejected otherwise
        }
      }
      placeMyOrder(company, action, filled, 'LMT', lmtPrice, false, false);
    } else if (orderStatus === 'Cancelled') {
      entryOrderIds[oId] = null;
      // since handleOpenOrder is not called for canceling, cleanup is needed here
      log('[Cancel lots]', company.symbol, company.oldExpiryPosition, company.lLotsLength, company.sLotsLength);
    }
  }
  log('OrderStatus:', oId, orderStatus, filled, remaining, avgFillPrice, lastFillPrice, clientId, whyHeld);
};

var handleOpenOrder = function() {};

var ibClient = new IbClient(companies, hourOffset, handleOrderStatus, handleValidOrderId, handleServerError, handleTickPrice, handleOpenOrder, handleRealTimeBar, handleConnectionClosed);

// Connect to the TWS client or IB Gateway
var connected = ibClient.connect('127.0.0.1', 7496, clientId);

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
