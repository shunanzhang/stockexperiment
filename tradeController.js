var GoogleCSVReader = require('./googleCSVReader');
var CLOSE_COLUMN = GoogleCSVReader.CLOSE_COLUMN;
var HIGH_COLUMN = GoogleCSVReader.HIGH_COLUMN;
var LOW_COLUMN = GoogleCSVReader.LOW_COLUMN;
var OPEN_COLUMN = GoogleCSVReader.OPEN_COLUMN;
var Sma = require('./sma');
var max = Math.max;
var min = Math.min;

var BUY = 'BUY';
var SELL = 'SELL';
var HOLD = 'HOLD';

var MINUTES_DAY = 390; // 390 minutes per day (9:30AM - 4:00PM ET)
var FIRST_OFFSET = 0.04 / 200;
var SECOND_OFFSET = 0.20 / 200;

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
TradeController.FIRST_OFFSET = FIRST_OFFSET;
TradeController.SECOND_OFFSET = SECOND_OFFSET;
TradeController.FIRST_OFFSET_POS = 1.0 + FIRST_OFFSET;
TradeController.FIRST_OFFSET_NEG = 1.0 - FIRST_OFFSET;
TradeController.SECOND_OFFSET_POS = 1.0 + SECOND_OFFSET;
TradeController.SECOND_OFFSET_NEG = 1.0 - SECOND_OFFSET;

TradeController.prototype.reset = function() {
  this.upper = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]; // length 8
  this.lower = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]; // length 8
  this.ks = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]; // length 8
  this.above = false;
  this.below = false;
  this.i = 0;
  this.d = 0.0;
  this.sma = new Sma(30);
};

TradeController.prototype.trade = function(datum, forceHold) {
  var close = datum[this.closeColumnIndex];
  var high = datum[this.highColumnIndex];
  var low = datum[this.lowColumnIndex];
  var open = datum[this.openColumnIndex];
  return this.tradeLogic(close, high, low, open, forceHold, this.i < 127, false);
};

TradeController.prototype.tradeLogic = function(close, high, low, open, forceHold, noSma, debug) {
  var result = HOLD;
  if (forceHold) {
    this.reset();
    return result;
  }
  var i = this.i + 1;
  this.i = i;
  var i_0 = (i - 7) & 7;
  var i_1 = (i - 6) & 7;
  var i_2 = (i - 5) & 7;
  var i_3 = (i - 4) & 7;
  var i_4 = (i - 3) & 7;
  var i_5 = (i - 2) & 7;
  var i_6 = (i - 1) & 7;
  var i_7 = i & 7;
  var upper = this.upper;
  var lower = this.lower;
  var ks = this.ks;
  upper[i_5] = high;
  lower[i_5] = low;
  var sma = this.sma;
  sma.push(close);
  // 6-3-3 Stochastic Oscillator
  if (i > 5) {
    var maxUpper = max(upper[i_0], upper[i_1], upper[i_2], upper[i_3], upper[i_4], high);
    var minLower = min(lower[i_0], lower[i_1], lower[i_2], lower[i_3], lower[i_4], low);
    var k = 11.111111 * (close - minLower) / (maxUpper - minLower); // 100 / 3 / 3 = 11.11111
    ks[i_7] = k;
    var d = this.d - ks[i_2] - ks[i_3] - ks[i_4] + ks[i_5] + ks[i_6] + k;
    this.d = d;
    if (i > 9) {
      if (debug) {
        console.log('k:', k, 'd:', d);
      }
      if (this.above && d <= 80.0 && (noSma || sma.down)) {
        result = SELL;
      } else if (this.below && d >= 20.0 && (noSma || sma.up)) {
        result = BUY;
      } else if (!this.below && d < 20.0) {
        result = SELL;
      }
      if (d < 20.0) {
        this.above = false;
        this.below = true;
      } else if (d > 80.0) {
        this.above = true;
        this.below = false;
      } else {
        this.above = false;
        this.below = false;
      }
    }
  }
  return result;
};
