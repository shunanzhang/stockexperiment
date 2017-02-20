var moment = require('./momenttz');
var Addon = require('./build/Release/addon');
var TradeController = Addon.TradeController;
var IbClient = Addon.IbClient;
var BUY = TradeController.BUY;
var SELL = TradeController.SELL;
var HOLD = TradeController.HOLD;
var CALL = TradeController.CALL;
var PUT = TradeController.PUT;
var Company = require('./company');
var Option = require('./option');
var max = Math.max;
var min = Math.min;
var round = Math.round;
var now = Date.now;
var log = console.log;

var cancelIds = {};
var symbols = {};
var entryOrderIds = {};
var actions = {};

var CLIENT_ID = 2;
var STOP_AMOUNT = 4.0; // TODO

var hourOffset = moment.tz(moment.TIMEZONE).utcOffset() / 60;

var underlying = new Company('ES');
var companies = [underlying];
//var companies = [new Option('ES', CALL, 2350)];

// Interactive Broker requires that you use orderId for every new order
// inputted. The orderId is incremented everytime you submit an order.
// Make sure you keep track of this.
var orderId = -1;

var placeMyOrder = function(company, action, quantity, orderType, lmtPrice, auxPrice, entry, modify) {
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
  ibClient.placeOrder(oldId, company.cancelId, action, quantity, orderType, lmtPrice, auxPrice, company.expiry);
  log((modify ? 'Modifying' : 'Placing'), 'order for', company.symbol, company.secType, action, quantity, orderType, lmtPrice, auxPrice, company.expiry, company.tickTime);
};

var handleValidOrderId = function(oId) {
  var company;
  for (var i = companies.length; i--;) {
    company = companies[i];
    cancelIds[company.cancelId] = company;
    symbols[company.symbol] = company;
  }
  orderId = oId;
  log('next order Id is', oId);
  ibClient.reqAllOpenOrders();
  //ibClient.reqAutoOpenOrders(true);
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

var handleRealTimeBar = function(reqId, barOpen, barHigh, barLow, barClose, volume, wap, count, second, minute, hour) {};

var handleTickPrice = function(tickerId, field, price, canAutoExecute) {
  var company = cancelIds[tickerId];
  if (company && price) {
    if (field === 9) { // last day close
      if (company.lastDayLock) {
        // last day close might happen multiple times in a day in case of connection errors
        return;
      }
      company.lastDayLock = true;
      log(company.symbol, company.secType, company.right, company.strike, 'last day close', price);
      log(company);
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
            placeMyOrder(company, action, company.onePosition, 'LMT', price, 0.0, false, true); // modify order
            company.tickTime = tickTime;
          }
        }
        log('Bid:', company.symbol, company.secType, company.right, company.strike, price);
      } else if (field === 2) { // ask price
        var ask = company.ask;
        company.ask = price;
        if (company.lastOrderStatus === 'Submitted' && action === SELL && ask > price && ask) {
          tickTime = now();
          if (tickTime > prevTickTime) { // wait more than 2 sec
            placeMyOrder(company, action, company.onePosition, 'LMT', price, 0.0, false, true); // modify order
            company.tickTime = tickTime;
          }
        }
        log('Ask:', company.symbol, company.secType, company.right, company.strike, price);
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
      var auxPrice = avgFillPrice + (isSell ? - STOP_AMOUNT : STOP_AMOUNT);
      var tickInverse = company.oneTickInverse;
      var reducedTickInverse = company.reducedTickInverse;
      if (auxPrice > 5.0) {
        auxPrice = round(auxPrice * tickInverse) / tickInverse; // required to place a correct order
      } else {
        auxPrice = round(auxPrice * reducedTickInverse) / reducedTickInverse;
      }
      auxPrice = max(auxPrice, company.minPrice);
      placeMyOrder(company, action, filled, 'STP LMT', auxPrice, auxPrice, false, false);
    } else if (orderStatus === 'Cancelled') {
      entryOrderIds[oId] = null;
      // since handleOpenOrder is not called for canceling, cleanup is needed here
      if (company.sLots[oId]) {
        company.sLots[oId] = null;
        company.sLotsLength -= 1;
      } else if (company.lLots[oId]) {
        company.lLots[oId] = null;
        company.lLotsLength -= 1;
      }
      log('[Cancel lots]', company.symbol, company.secType, company.lLotsLength, company.sLotsLength);
    }
  }
  log('OrderStatus:', oId, orderStatus, filled, remaining, avgFillPrice, lastFillPrice, clientId, whyHeld);
};

var handleOpenOrder = function(oId, symbol, expiry, action, totalQuantity, orderType, lmtPrice, orderStatus, clientId) {
  var company = entryOrderIds[oId];
  if (company === undefined) { // if exiting the position
    company = symbols[symbol];
    if (company && clientId === CLIENT_ID) {
      var order = {
        action: action,
        totalQuantity: totalQuantity,
        orderType: orderType,
        lmtPrice: lmtPrice
      };
      var sLots = company.sLots;
      var lLots = company.lLots;
      if (orderStatus === 'Filled' || orderStatus === 'Cancelled') { // in reality, Cancelled is never called
        if (action === BUY) {
          if (sLots[oId]) {
            sLots[oId] = null;
            company.sLotsLength -= 1;
          }
        } else if (action === SELL) {
          if (lLots[oId]) {
            lLots[oId] = null;
            company.lLotsLength -= 1;
          }
        }
        log('[Delete lots]', symbol, company.secType, company.lLotsLength, company.sLotsLength);
      } else if (orderStatus !== 'Inactive') {
        if (action === BUY) {
          if (!sLots[oId]) {
            sLots[oId] = order;
            company.sLotsLength += 1;
          }
        } else if (action === SELL) {
          if (!lLots[oId]) {
            lLots[oId] = order;
            company.lLotsLength += 1;
          }
        }
        log('[Append lots]', symbol, company.secType, company.lLotsLength, company.sLotsLength);
      }
    }
  }
  log('OpenOrder:', oId, symbol, company.secType, expiry, action, totalQuantity, orderType, lmtPrice, orderStatus);
};

var ibClient = new IbClient(companies, hourOffset, handleOrderStatus, handleValidOrderId, handleServerError, handleTickPrice, handleOpenOrder, handleRealTimeBar, handleConnectionClosed);

// Connect to the TWS client or IB Gateway
var connected = ibClient.connect('127.0.0.1', 7496, CLIENT_ID);

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
