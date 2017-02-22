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
var ceil = Math.ceil;
var floor = Math.floor;
var now = Date.now;
var log = console.log;

var cancelIds = {};
var symbols = {};
var entryOrderIds = {};
var actions = {};

var CLIENT_ID = 2;
var LMT = 'LMT';

var hourOffset = moment.tz(moment.TIMEZONE).utcOffset() / 60;

var base = new Company('ES');
var prevCall = null;
var prevPut = null;
var nextCall = null;
var nextPut = null;

// Interactive Broker requires that you use orderId for every new order
// inputted. The orderId is incremented everytime you submit an order.
// Make sure you keep track of this.
var orderId = -1;

var getCallStrike = function(strikeIntervalInverse) {
  return ceil((base.ask + 0.001) * strikeIntervalInverse) / strikeIntervalInverse;
};

var getPutStrike = function(strikeIntervalInverse, strikeInterval) {
  return floor(base.ask * strikeIntervalInverse) / strikeIntervalInverse - 4 * strikeInterval;
};

var roundPremium = function(bid, ask, oneTickInverse, reduceThreshold, reducedTickInverse, minPrice) {
  var premium = (bid + ask) / 2.0;
  var tickInverse = (premium > reduceThreshold) ? oneTickInverse : reducedTickInverse;
  premium = round(premium * tickInverse) / tickInverse;
  return max(premium, minPrice);
};

var reqPositionsCalled = false;
var checkPrice = function(cancelId) {
  var lmtPrice = 0.0;
  if (cancelId === base.cancelId) {
    if (!reqPositionsCalled && base.ask) {
      reqPositionsCalled = true;
      ibClient.reqPositions();
    }
  } else if (cancelId === prevCall.cancelId) {
    if (prevCall.bid && prevCall.ask) {
      // TODO check previously submitted closing order
      lmtPrice = roundPremium(prevCall.bid, prevCall.ask, prevCall.oneTickInverse, prevCall.reduceThreshold, prevCall.reducedTickInverse, prevCall.minPrice);
      placeMyOrder(prevCall, SELL, prevCall.onePosition, LMT, lmtPrice, true, false);
    }
  } else if (cancelId === prevPut.cancelId) {
    if (prevPut.bid && prevPut.ask) {
      // TODO check previously submitted closing order
      lmtPrice = roundPremium(prevPut.bid, prevPut.ask, prevPut.oneTickInverse, prevPut.reduceThreshold, prevPut.reducedTickInverse, prevPut.minPrice);
      placeMyOrder(prevPut, SELL, prevPut.onePosition, LMT, lmtPrice, true, false);
    }
  }
};

var registerCompany = function(company) {
  if (!cancelIds[company.cancelId]) {
    cancelIds[company.cancelId] = company;
    symbols[company.symbol] = company;
    ibClient.updateContract(company);
    ibClient.reqMktData(company.cancelId, '', false);
  }
};

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
  log((modify ? 'Modifying' : 'Placing'), 'order for', company.symbol, company.secType, action, quantity, orderType, lmtPrice, company.expiry, company.tickTime);
};

var handleValidOrderId = function(oId) {
  orderId = oId;
  log('next order Id is', oId);
  registerCompany(base);
  ibClient.reqAllOpenOrders();
  //ibClient.reqAutoOpenOrders(true);
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
  if (company && price > 0.0) {
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
      var lmtPrice = 0.0;
      if (field === 1) { // bid price
        var bid = company.bid;
        company.bid = price;
        if (company.lastOrderStatus === 'Submitted' && action === BUY && bid < price && bid) {
          tickTime = now();
          if (tickTime > prevTickTime) { // wait more than 2 sec
            lmtPrice = roundPremium(price, company.ask, company.oneTickInverse, company.reduceThreshold, company.reducedTickInverse, company.minPrice);
            placeMyOrder(company, action, company.onePosition, LMT, lmtPrice, false, true); // modify order
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
            lmtPrice = roundPremium(company.bid, price, company.oneTickInverse, company.reduceThreshold, company.reducedTickInverse, company.minPrice);
            placeMyOrder(company, action, company.onePosition, LMT, lmtPrice, false, true); // modify order
            company.tickTime = tickTime;
          }
        }
        log('Ask:', company.symbol, company.secType, company.right, company.strike, price);
      }
      checkPrice(tickerId);
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

var handlePosition = function(symbol, secType, expiry, right, strike, position, avgCost){
  var newStrike = 0.0;
  if (right === CALL) {
    prevCall = new Option('ES', CALL, strike);
    newStrike = getCallStrike(prevCall.strikeIntervalInverse);
    if (strike !== newStrike) {
      registerCompany(prevCall);
    } else if (position > 0) {
      prevCall.done = true;
      nextCall.done = true;
    }
  } else if (right === PUT) {
    prevPut = new Option('ES', PUT, strike);
    newStrike = getPutStrike(prevPut.strikeIntervalInverse, prevPut.strikeInterval);
    if (strike !== newStrike) {
      registerCompany(prevPut);
    } else if (position > 0) {
      prevPut.done = true;
      nextPut.done = true;
    }
  }
  checkDone();
};

var checkDone = function() {
  if (prevCall.done && prevPut.done && nextCall.done && nextPut.done) {
    log('Succeeded');
    process.exit(0);
  }
};

var ibClient = new IbClient(new Array(5), hourOffset, handleOrderStatus, handleValidOrderId, handleServerError, handleTickPrice, handleOpenOrder, handleRealTimeBar, handleConnectionClosed, handlePosition);

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
