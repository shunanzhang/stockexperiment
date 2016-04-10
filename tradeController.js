var GoogleCSVReader = require('./googleCSVReader');
var CLOSE_COLUMN = GoogleCSVReader.CLOSE_COLUMN;
var HIGH_COLUMN = GoogleCSVReader.HIGH_COLUMN;
var LOW_COLUMN = GoogleCSVReader.LOW_COLUMN;
var OPEN_COLUMN = GoogleCSVReader.OPEN_COLUMN;
var toCent = require('./utils').toCent;

var BUY = 'BUY';
var SELL = 'SELL';
var HOLD = 'HOLD';
var L = 'L';
var S = 'S';

var MINUTES_DAY = 390; // 390 minutes per day (9:30AM - 4:00PM ET)
var FIRST_OFFSET = 0.04 / 200;
var SECOND_OFFSET = 0.14 / 200;
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
TradeController.FIRST_OFFSET = FIRST_OFFSET;
TradeController.SECOND_OFFSET = SECOND_OFFSET;
TradeController.FIRST_OFFSET_POS = 1.0 + FIRST_OFFSET;
TradeController.FIRST_OFFSET_NEG = 1.0 - FIRST_OFFSET;
TradeController.SECOND_OFFSET_POS = 1.0 + SECOND_OFFSET;
TradeController.SECOND_OFFSET_NEG = 1.0 - SECOND_OFFSET;
TradeController.L = L;
TradeController.S = S;

TradeController.prototype.reset = function() {
  this.upper = [];
  this.lower = [];
  this.ks = [];
  this.above = false;
  this.below = false;
};

TradeController.prototype.tradeWithRealtimeBar = function(realtimeBar, forceHold) {
  var datum = [0, 0, 0, 0, 0]; // contiguous keys starting at 0 for performance
  datum[this.closeColumnIndex] = toCent(realtimeBar.close);
  datum[this.highColumnIndex] = toCent(realtimeBar.high);
  datum[this.lowColumnIndex] = toCent(realtimeBar.low);
  datum[this.openColumnIndex] = toCent(realtimeBar.open);
  return this.trade(datum, forceHold, true);
};

TradeController.prototype.trade = function(datum, forceHold, debug) {
  var close = datum[this.closeColumnIndex];
  var high = datum[this.highColumnIndex];
  var low = datum[this.lowColumnIndex];
  var open = datum[this.openColumnIndex];
  var result = HOLD;
  if (forceHold) {
    this.reset();
    return result;
  }
  var upper = this.upper;
  var lower = this.lower;
  var ks = this.ks;
  upper.push(high);
  lower.push(low);
  // 6-4-4 Stochastic Oscillator
  if (upper.length > 5 && lower.length > 5) {
    var maxUpper = max.apply(null, upper);
    var minLower = min.apply(null, lower);
    var k = 6.25 * (close - minLower) / (maxUpper - minLower); // 100 / 16 = 6.25
    ks.push(k);
    if (ks.length > 6) {
      var d = ks[0] + ks[6] + 2.0 * (ks[1] + ks[5]) + 3.0 * (ks[2] + ks[4]) + 4.0 * ks[3];
      if (debug) {
        console.log('k:', k, 'd:', d);
      }
      if (this.above && d <= 80.0) {
        result = SELL;
      } else if (this.below && d >= 20.0) {
        result = BUY;
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
      ks.shift();
    }
    upper.shift();
    lower.shift();
  }
  return result;
};
