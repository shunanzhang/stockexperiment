var GoogleCSVReader = require('./googleCSVReader');
var CLOSE_COLUMN = GoogleCSVReader.CLOSE_COLUMN;
var HIGH_COLUMN = GoogleCSVReader.HIGH_COLUMN;
var LOW_COLUMN = GoogleCSVReader.LOW_COLUMN;
var OPEN_COLUMN = GoogleCSVReader.OPEN_COLUMN;
var utils = require('./utils');
var toCent = utils.toCent;
var MAX_INT = utils.MAX_INT;
var MIN_INT = utils.MIN_INT;

var BUY = 'buy';
var SELL = 'sell';
var HOLD = 'hold';

var MINUTES_DAY = 390; // 390 minutes per day (9:30AM - 4:00PM ET)
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
  this.lower =  [];
  this.lastBox = [0, 0, 0, 0, 0, 0];
  this.lastMax = [MAX_INT, MAX_INT, MAX_INT, MAX_INT, MAX_INT, MAX_INT];
  this.lastMin = [MIN_INT, MIN_INT, MIN_INT, MIN_INT, MIN_INT, MIN_INT];
  this.clear();
};

TradeController.prototype.clear = function() {
  this.lastPos = HOLD;
  this.lastEntry = 0;
};

TradeController.prototype.tradeWithRealtimeBar = function(realtimeBar, forceHold, lastOrder) {
  var datum = [0, 0, 0, 0, 0]; // contiguous keys starting at 0 for performance
  datum[this.closeColumnIndex] = toCent(realtimeBar.close);
  datum[this.highColumnIndex] = toCent(realtimeBar.high);
  datum[this.lowColumnIndex] = toCent(realtimeBar.low);
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
  var period = 20;
  var takeProfit = close * 0.0051 | 0;
  var cutLoss = close * -0.0047 | 0;
  var upper = this.upper;
  var lower = this.lower;
  upper.push(high);
  lower.push(low);
  if (upper.length <= period || lower.length <= period) {
    this.clear();
    return this.lastPos;
  }
  upper.shift();
  lower.shift();
  var lastBox = this.lastBox;
  lastBox.shift();
  lastBox.push(close - open);
  var nBull = 0;
  var nBear = 0;
  for (var i = lastBox.length; i--;) {
    var box = lastBox[i];
    if (box > 1) {
      nBull += 1;
    } else if (box < -1) {
      nBear += 1;
    }
  }
  var localMax = max.apply(null, upper);
  var localMin = min.apply(null, lower);
  var lastMax = this.lastMax;
  var lastMin = this.lastMin;
  lastMax.push(localMax);
  lastMin.push(localMin);
  var pl = close - this.lastEntry;
  if (lastOrder) {
    if ((this.lastPos === BUY && pl > 0) || (this.lastPos === SELL && pl < 0)) {
      this.clear();
    }
  } else if (nBull > 3 && lastMax[0] + 1 === min.apply(null, upper.slice(period - 6))) {
    this.lastPos = BUY;
    if (this.lastEntry === 0) {
      this.lastEntry = close;
    }
  } else if (nBear > 3 && lastMin[0] - 1 === max.apply(null, lower.slice(period - 6))) {
    this.lastPos = SELL;
    if (this.lastEntry === 0) {
      this.lastEntry = close;
    }
  } else if ((this.lastPos === BUY && (nBear > 5 || pl > takeProfit || pl < cutLoss)) || (this.lastPos === SELL && (nBull > 5 || -pl > takeProfit || -pl < cutLoss))) {
    this.clear();
  }
  lastMax.shift();
  lastMin.shift();
  return this.lastPos;
};
