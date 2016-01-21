var GoogleCSVReader = require('./googleCSVReader');
var HIGH_COLUMN = GoogleCSVReader.HIGH_COLUMN;
var LOW_COLUMN = GoogleCSVReader.LOW_COLUMN;
var utils = require('./utils');
var toCent = utils.toCent;
var MAX_INT = utils.MAX_INT;
var MIN_INT = utils.MIN_INT;

var BUY = 'buy';
var SELL = 'sell';
var HOLD = 'hold';

var MINUTES_DAY = 390; // 390 minutes per day (9:30AM - 4:00PM ET)

var TradeController = module.exports = function(columns) {
  if (! (this instanceof TradeController)) { // enforcing new
    return new TradeController(columns);
  }
  this.highColumnIndex = columns[HIGH_COLUMN];
  this.lowColumnIndex = columns[LOW_COLUMN];
  this.reset();
};
TradeController.BUY = BUY;
TradeController.SELL = SELL;
TradeController.HOLD = HOLD;
TradeController.MINUTES_DAY = MINUTES_DAY;

TradeController.prototype.reset = function() {
  this.lastPos = HOLD;
  this.ceiling = [MAX_INT, MAX_INT];
  this.bottom = [MIN_INT, MIN_INT];
  this.localCeiling = [MAX_INT, MAX_INT, MAX_INT];
  this.localBottom = [MIN_INT, MIN_INT, MIN_INT];
  this.lastHigh = MIN_INT;
  this.lastLow = MAX_INT;
};

TradeController.prototype.tradeWithRealtimeBar = function(realtimeBar, forceHold) {
  var datum = [0, 0, 0, 0, 0]; // contiguous keys starting at 0 for performance
  datum[this.highColumnIndex] = toCent(realtimeBar.high);
  datum[this.lowColumnIndex] = toCent(realtimeBar.low);
  return this.trade(datum, forceHold);
};

TradeController.prototype.trade = function(datum, forceHold) {
  var high = datum[this.highColumnIndex];
  var low = datum[this.lowColumnIndex];
  if (forceHold) {
    this.reset();
    return this.lastPos;
  }
  //console.log(new Date(), this.ceiling, this.bottom, this.localCeiling, this.localBottom, this.lastHigh, this.lastLow, high, low);
  if (this.lastHigh >= high && this.lastLow <= low) { // if inside bar
    return this.lastPos;
  }
  this.lastHigh = high;
  this.lastLow = low;
  var localCeiling = this.localCeiling;
  var localBottom = this.localBottom;
  localCeiling.shift();
  localBottom.shift();
  localCeiling.push(high);
  localBottom.push(low);
  var localCeiling1 = localCeiling[1];
  var localBottom1 = localBottom[1];
  var sharp = 8;
  if (localCeiling[0] < localCeiling1 - sharp && localCeiling1 - sharp > localCeiling[2]) {
    var ceiling = this.ceiling;
    ceiling.shift();
    ceiling.push(localCeiling1);
    if (ceiling[0] - sharp > ceiling[1]) {
      this.lastPos = SELL;
    }
  } else if (localBottom[0] > localBottom1 + sharp && localBottom1 + sharp < localBottom[2]) {
    var bottom = this.bottom;
    bottom.shift();
    bottom.push(localBottom1);
    if (bottom[0] + sharp < bottom[1]) {
      this.lastPos = BUY;
    }
  }
  return this.lastPos;
};
