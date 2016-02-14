var GoogleCSVReader = require('./googleCSVReader');
var CLOSE_COLUMN = GoogleCSVReader.CLOSE_COLUMN;
var OPEN_COLUMN = GoogleCSVReader.OPEN_COLUMN;
var toCent = require('./utils').toCent;

var BUY = 'buy';
var SELL = 'sell';
var HOLD = 'hold';

var MINUTES_DAY = 390; // 390 minutes per day (9:30AM - 4:00PM ET)

var TradeController = module.exports = function(columns) {
  if (! (this instanceof TradeController)) { // enforcing new
    return new TradeController(columns);
  }
  this.closeColumnIndex = columns[CLOSE_COLUMN];
  this.openColumnIndex = columns[OPEN_COLUMN];
  this.reset();
};
TradeController.BUY = BUY;
TradeController.SELL = SELL;
TradeController.HOLD = HOLD;
TradeController.MINUTES_DAY = MINUTES_DAY;

TradeController.prototype.reset = function() {
  this.lastBar = 0;
  this.barCount = 0;
  this.contLoss = 0;
  this.ddCount = 0;
  this.clear();
};

TradeController.prototype.clear = function() {
  this.lastPos = HOLD;
  this.lastEntry = 0;
  this.minHold = 0;
};

TradeController.prototype.tradeWithRealtimeBar = function(realtimeBar, forceHold, lastOrder, giveup) {
  var datum = [0, 0, 0, 0, 0]; // contiguous keys starting at 0 for performance
  datum[this.closeColumnIndex] = toCent(realtimeBar.close);
  datum[this.openColumnIndex] = toCent(realtimeBar.open);
  return this.trade(datum, forceHold, lastOrder, giveup);
};

TradeController.prototype.trade = function(datum, forceHold, lastOrder, giveup) {
  var close = datum[this.closeColumnIndex];
  var open = datum[this.openColumnIndex];
  if (forceHold) {
    this.reset();
    return this.lastPos;
  }
  var takeProfit = 0.00579;
  var cutLoss = 0.00161;
  var cutLossR = 0.00159;
  var reEntry = 0.00387;
  var systemHalt = 0.036;
  var ddCoutLimit = 139;
  var ddCoutLimitR = 153;
  var holdingTime = 2;
  var holdingTimeR = 2;
  var minHold = --this.minHold;
  var lastPos = this.lastPos;
  var lastEntry = this.lastEntry;
  var lastBar = this.lastBar;
  var barCount = this.barCount;
  if (lastBar < 0) {
    if (barCount > 0) {
      barCount = 0;
    }
    this.barCount = --barCount;
  } else if (lastBar > 0) {
    if (barCount < 0) {
      barCount = 0;
    }
    this.barCount = ++barCount;
  }
  if (lastBar) { // lastBar !== 0
    var ratio = (close * close) / (lastEntry * lastEntry) - 1.0;
    var entryBar = close * 0.0007;
    var contLoss = this.contLoss;
    if ((lastPos === HOLD && contLoss === 0 && (lastBar < -entryBar || lastBar > entryBar)) ||
        (lastPos === BUY && (ratio >= takeProfit || ((ratio <= -cutLoss || barCount < -5) && contLoss < 4))) ||
        (lastPos === SELL && (ratio <= -takeProfit || ((ratio >= cutLossR || barCount > 6) && contLoss < 4)))) {
      if ((lastPos === BUY && close < lastEntry) || (lastPos === SELL && close > lastEntry)) {
        this.contLoss += 1;
      } else if (lastPos !== HOLD) {
        this.contLoss = 0;
      }
      if (lastOrder) {
        if ((lastPos === BUY && close > lastEntry) || (lastPos === SELL && close < lastEntry)) {
          this.clear();
        }
      } else if (minHold > 0) {
        this.lastEntry = close;
      } else if (lastBar > 1) {
        this.lastPos = BUY;
        this.lastEntry = close;
        if (lastPos === SELL) {
          if (ratio <= -takeProfit) {
            this.minHold = holdingTime;
          }
        }
      } else if (lastBar < 0) { // biasing to sell rather than < -1
        this.lastPos = SELL;
        this.lastEntry = close;
        if (lastPos === BUY) {
          this.minHold = 3;
          if (ratio >= takeProfit) {
            this.minHold = holdingTimeR;
          }
        }
      }
      this.ddCount = 0;
    } else if (contLoss > 3) {
      //console.log(new Date((datum[0] + 60 * 60 * 3 - 60) * 1000).toLocaleTimeString(), this.ddCount, ratio);
      if (giveup) {
        if (lastPos === BUY) {
          return SELL;
        } else {
          return BUY;
        }
      } else
      if (lastPos === BUY && this.ddCount > ddCoutLimit) {
        return SELL;
      } else if (lastPos === SELL && this.ddCount > ddCoutLimitR) {
        return BUY;
      } else if (lastPos === BUY && ratio >= reEntry && lastEntry) {
        return BUY;
      } else if (lastPos === SELL && ratio <= -reEntry && lastEntry) {
        return SELL;
      } else if ((lastPos === BUY && ratio <= -systemHalt) || (lastPos === SELL && ratio >= systemHalt)) {
        this.lastPos = HOLD;
      }
      this.ddCount += 1;
    } else if (lastEntry && close > lastEntry + 50 && contLoss > 1) {
      this.lastEntry -= 0 - contLoss;
    } else if (lastEntry && close < lastEntry - 49 && contLoss > 1) {
      this.lastEntry += 3 + contLoss;
    }
  }
  this.lastBar = close - open;
  return this.lastPos;
};
