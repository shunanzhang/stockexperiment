var GoogleCSVReader = require('./googleCSVReader');
var CLOSE_COLUMN = GoogleCSVReader.CLOSE_COLUMN;
var HIGH_COLUMN = GoogleCSVReader.HIGH_COLUMN;
var LOW_COLUMN = GoogleCSVReader.LOW_COLUMN;
var OPEN_COLUMN = GoogleCSVReader.OPEN_COLUMN;
var toCent = require('./utils').toCent;

var BUY = 'buy';
var SELL = 'sell';
var HOLD = 'hold';

var MINUTES_DAY = 390; // 390 minutes per day (9:30AM - 4:00PM ET)
var abs = Math.abs;
var max = Math.max;
var min = Math.min;

var TradeController = module.exports = function(columns) {
  if (! (this instanceof TradeController)) { // enforcing new
    return new TradeController(columns);
  }
  this.closeColumnIndex = columns[CLOSE_COLUMN];
  this.highColumnIndex = columns[HIGH_COLUMN];
  this.lowColumnIndex = columns[LOW_COLUMN];
  this.openColumnIndex = columns[OPEN_COLUMN];
  this.reset();
};
TradeController.BUY = BUY;
TradeController.SELL = SELL;
TradeController.HOLD = HOLD;
TradeController.MINUTES_DAY = MINUTES_DAY;

TradeController.prototype.reset = function() {
  this.upper = [];
  this.lower = [];
  this.sumBar = 0;
  this.barCount = 0;
  this.contLoss = 0;
  this.clear();
};

TradeController.prototype.clear = function() {
  this.lastPos = HOLD;
  this.lastEntry = 0;
  this.driftCount = 0;
  this.lastHigh = 0;
  this.lastLow = 0;
  this.boughtAbove = false;
  this.soldBelow = false;
  this.lastTaller = false;
};

TradeController.prototype.tradeWithRealtimeBar = function(realtimeBar, forceHold, lastOrder) {
  var datum = [0, 0, 0, 0, 0]; // contiguous keys starting at 0 for performance
  datum[this.closeColumnIndex] = toCent(realtimeBar.close);
  datum[this.highColumnIndex] = toCent(realtimeBar.close);
  datum[this.lowColumnIndex] = toCent(realtimeBar.close);
  datum[this.openColumnIndex] = toCent(realtimeBar.open);
  return this.trade(datum, forceHold, lastOrder);
};

TradeController.prototype.trade = function(datum, forceHold, lastOrder) {
  var close = datum[this.closeColumnIndex];
  var high = datum[this.highColumnIndex];
  var low = datum[this.lowColumnIndex];
  var open = datum[this.openColumnIndex];
  if (forceHold) {
    this.reset();
    return this.lastPos;
  }
  var upper = this.upper;
  var lower = this.lower;
  var barHeight = abs(close - open);
  var ratio =  this.sumBar / this.barCount / close;
  var taller = barHeight > ratio * 23747;
  var taller2 = high - low > ratio * 48347;
  if (upper.length > 18 && lower.length > 18 && this.contLoss < 3) {
    var bothTaller = taller2 && this.lastTaller;
    var buy = false;
    var sell = false;
    var maxUpper = max.apply(null, upper);
    var minLower = min.apply(null, lower);
    if (bothTaller) {
      if (maxUpper === upper[18] && maxUpper < high && close > open) {
        buy = true;
      }
      if (minLower === lower[18] && minLower > low && close < open) {
        sell = true;
      }
    }
    var lastHigh = this.lastHigh;
    var lastLow = this.lastLow;
    var driftCount = this.driftCount;
    if (lastLow === low && lastHigh === high) {
      driftCount = 0;
    } else if (lastLow <= low && lastHigh <= high) {
      if (driftCount < 0) {
        driftCount = 0;
      }
      driftCount += 1;
    } else if (lastLow >= low && lastHigh >= high) {
      if (driftCount > 0) {
        driftCount = 0;
      }
      driftCount -= 1;
    } else {
      driftCount = 0;
    }
    if (driftCount > 8) {
      sell = false;
      buy = true;
    } else if (driftCount < -8) {
      buy = false;
      sell = true;
    }
    this.driftCount = driftCount;
    var mid = (max(maxUpper, high) + min(minLower, low)) / 2.0;
    var lastPos = this.lastPos;
    var lastEntry = this.lastEntry;
    if (lastOrder) {
      if ((lastPos === BUY && close > lastEntry) || (lastPos === SELL && close < lastEntry)) {
        this.clear();
      }
    } else if ((lastPos === BUY && mid > low && this.boughtAbove) || (lastPos === SELL && mid < high && this.soldBelow)) {
      if ((lastPos === BUY && close < lastEntry) || (lastPos === SELL && close > lastEntry)) {
        this.contLoss += 1;
      }
      this.boughtAbove = false;
      this.soldBelow = false;
      this.lastPos = HOLD;
    } else if (buy && !sell) {
      if (lastPos !== BUY) {
        this.lastEntry = close;
        this.boughtAbove = false;
      }
      this.lastPos = BUY;
    } else if (!buy && sell) {
      if (lastPos !== SELL) {
        this.lastEntry = close;
        this.soldBelow = false;
      }
      this.lastPos = SELL;
    }
    if (this.lastPos === BUY && mid < low) {
      this.boughtAbove = true;
    }
    if (this.lastPos === SELL && mid > high) {
      this.soldBelow = true;
    }
    upper.shift();
    lower.shift();
  }
  this.lastHigh = high;
  this.lastLow = low;
  this.lastTaller = taller;
  this.sumBar += barHeight;
  this.barCount += 1;
  upper.push(high);
  lower.push(low);
  return this.lastPos;
};
