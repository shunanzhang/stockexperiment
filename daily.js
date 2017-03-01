var moment = require('./momenttz');
var Addon = require('./build/Release/addon');
var TradeController = Addon.TradeController;
var IbClient = Addon.IbClient;
var BUY = TradeController.BUY;
var SELL = TradeController.SELL;
var CALL = TradeController.CALL;
var PUT = TradeController.PUT;
var Company = require('./company');
var Option = require('./option');
var max = Math.max;
var round = Math.round;
var ceil = Math.ceil;
var floor = Math.floor;
var now = Date.now;
var log = console.log;

var cancelIds = {};
var entryOrderIds = {};
var actions = {};

var CLOSE_ONLY = (process.argv[2] || false) === 'true';
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

var getPutStrike = function(strikeIntervalInverse) {
  return (floor(base.ask * strikeIntervalInverse) - 4) / strikeIntervalInverse;
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
  if (base && cancelId === base.cancelId) {
    if (!reqPositionsCalled && base.ask) {
      reqPositionsCalled = true;
      ibClient.reqPositions();
      setTimeout(ifNoPosition, 60 * 1000);
    }
  } else if (prevCall && cancelId === prevCall.cancelId) {
    if (prevCall.bid && prevCall.ask && !prevCall.pending) {
      prevCall.pending = true;
      lmtPrice = roundPremium(prevCall.bid, prevCall.ask, prevCall.oneTickInverse, prevCall.reduceThreshold, prevCall.reducedTickInverse, prevCall.minPrice);
      placeMyOrder(prevCall, SELL, prevCall.onePosition, LMT, lmtPrice, true, false);
    }
  } else if (prevPut && cancelId === prevPut.cancelId) {
    if (prevPut.bid && prevPut.ask && !prevPut.pending) {
      prevPut.pending = true;
      lmtPrice = roundPremium(prevPut.bid, prevPut.ask, prevPut.oneTickInverse, prevPut.reduceThreshold, prevPut.reducedTickInverse, prevPut.minPrice);
      placeMyOrder(prevPut, SELL, prevPut.onePosition, LMT, lmtPrice, true, false);
    }
  } else if (nextCall && cancelId === nextCall.cancelId) {
    if (nextCall.bid && nextCall.ask && !nextCall.pending) {
      nextCall.pending = true;
      lmtPrice = roundPremium(nextCall.bid, nextCall.ask, nextCall.oneTickInverse, nextCall.reduceThreshold, nextCall.reducedTickInverse, nextCall.minPrice);
      placeMyOrder(nextCall, BUY, nextCall.onePosition, LMT, lmtPrice, true, false);
    }
  } else if (nextPut && cancelId === nextPut.cancelId) {
    if (nextPut.bid && nextPut.ask && !nextPut.pending) {
      nextPut.pending = true;
      lmtPrice = roundPremium(nextPut.bid, nextPut.ask, nextPut.oneTickInverse, nextPut.reduceThreshold, nextPut.reducedTickInverse, nextPut.minPrice);
      placeMyOrder(nextPut, BUY, nextPut.onePosition, LMT, lmtPrice, true, false);
    }
  }
};

var ifNoPosition = function() {
  if (CLOSE_ONLY) {
    log('No position');
    process.exit(0);
  } else if (!prevCall && !prevPut && !nextCall && !nextPut) {
    prevCall = new Option('ES', CALL, 0.0, true);
    prevCall.done = true;
    var callStrike = getCallStrike(prevCall.strikeIntervalInverse);
    nextCall = new Option('ES', CALL, callStrike, false);
    registerCompany(nextCall);

    prevPut = new Option('ES', PUT, 0.0, true);
    prevPut.done = true;
    var putStrike = getPutStrike(prevPut.strikeIntervalInverse);
    nextPut = new Option('ES', PUT, putStrike, false);
    registerCompany(nextPut);
  }
};

var registerCompany = function(company) {
  if (!cancelIds[company.cancelId]) {
    cancelIds[company.cancelId] = company;
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
    }
  }
  log('OrderStatus:', oId, orderStatus, filled, remaining, avgFillPrice, lastFillPrice, clientId, whyHeld);
};

var handleOpenOrder = function(oId, symbol, expiry, action, totalQuantity, orderType, lmtPrice, orderStatus, clientId) {};

var handlePosition = function(symbol, secType, expiry, right, strike, position, avgCost) {
  if (position < 0 && strike) {
    log(Date(), '[UnexpectedPosition]', symbol, secType, expiry, right, strike, position, avgCost);
    process.exit(1);
  }
  if (right === CALL) {
    if (nextCall && strike === nextCall.strike) {
      if (position > 0) {
        nextCall.done = true;
      } else {
        log(Date(), '[ShouldNotBeHere]', symbol, secType, expiry, right, strike, position, avgCost);
      }
    } else if (!prevCall) {
      if (position > 0) {
        prevCall = new Option('ES', CALL, strike, true);
        var callStrike = getCallStrike(prevCall.strikeIntervalInverse);
        nextCall = new Option('ES', CALL, callStrike, false);
        if (strike !== callStrike || prevCall.expiry !== nextCall.expiry) { // the target strike price has been changed, close the current and buy new
          registerCompany(prevCall);
          if (CLOSE_ONLY) {
            nextCall.done = true;
          } else {
            registerCompany(nextCall);
          }
        } else { // nothing to change
          prevCall.done = true;
          nextCall.done = true;
        }
      } else {
        log(Date(), '[ShouldNotBeHere]', symbol, secType, expiry, right, strike, position, avgCost);
      }
    } else if (strike === prevCall.strike && position === 0) { // closed the previous position
      prevCall.done = true;
    }
  } else if (right === PUT) {
    if (nextPut && strike === nextPut.strike) {
      if (position > 0) {
        nextPut.done = true;
      } else {
        log(Date(), '[ShouldNotBeHere]', symbol, secType, expiry, right, strike, position, avgCost);
      }
    } else if (!prevPut) {
      if (position > 0) {
        prevPut = new Option('ES', PUT, strike, true);
        var putStrike = getPutStrike(prevPut.strikeIntervalInverse);
        nextPut = new Option('ES', PUT, putStrike, false);
        if (strike !== putStrike || prevPut.expiry !== nextPut.expiry) { // the target strike price has been changed, close the current and buy new
          registerCompany(prevPut);
          if (CLOSE_ONLY) {
            nextPut.done = true;
          } else {
            registerCompany(nextPut);
          }
        } else { // nothing to change
          prevPut.done = true;
          nextPut.done = true;
        }
      } else {
        log(Date(), '[ShouldNotBeHere]', symbol, secType, expiry, right, strike, position, avgCost);
      }
    } else if (strike === prevPut.strike && position === 0) { // closed the previous position
      prevPut.done = true;
    }
  }
  checkDone();
};

var checkDone = function() {
  if (prevCall && prevPut && nextCall && nextPut && prevCall.done && prevPut.done && nextCall.done && nextPut.done) {
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
