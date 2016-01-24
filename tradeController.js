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
  this.ceiling = MAX_INT;
  this.bottom = MIN_INT;
  this.localCeiling0 = MAX_INT;
  this.localBottom0 = MIN_INT;
  this.localCeiling1 = MAX_INT;
  this.localBottom1 = MIN_INT;
  this.lastHigh = MIN_INT;
  this.lastLow = MAX_INT;
  this.lastEntry = 0;
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
  if (this.lastHigh >= high && this.lastLow <= low) { // if inside bar
    return this.lastPos;
  }
  this.lastHigh = high;
  this.lastLow = low;
  var localCeiling1 = this.localCeiling1;
  var localBottom1 = this.localBottom1;
  var sharp = 8;
  if (this.localCeiling0 < localCeiling1 - sharp - 1 && localCeiling1 - sharp > high) {
    if (this.ceiling - sharp > localCeiling1) {
      this.lastEntry = high;
      this.lastPos = SELL;
    }
    this.ceiling = localCeiling1;
  } else if (this.localBottom0 > localBottom1 + sharp - 1 && localBottom1 + sharp < low) {
    if (this.bottom + sharp < localBottom1) {
      this.lastEntry = low;
      this.lastPos = BUY;
    }
    this.bottom = localBottom1;
  }
  this.localCeiling0 = localCeiling1;
  this.localBottom0 = localBottom1;
  this.localCeiling1 = high;
  this.localBottom1 = low;
  var lossCut = 213;
  if ((this.lastPos === BUY && this.lastEntry < low - lossCut) || (this.lastPos === SELL && this.lastEntry > high + lossCut)) {
    this.reset();
  }
  // Stop-and-Reverse
  //var lossCut = 106;
  //if (this.lastPos === BUY && this.lastEntry < high - lossCut) {
  //    this.lastEntry = high;
  //    this.lastPos = SELL;
  //} else if (this.lastPos === SELL && this.lastEntry > low + lossCut) {
  //    this.lastEntry = low;
  //    this.lastPos = BUY;
  //}
  return this.lastPos;
};
