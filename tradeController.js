var Sma = require('./sma');
var max = Math.max;
var min = Math.min;

var BUY = 'BUY';
var SELL = 'SELL';
var HOLD = 'HOLD';

var OFFSET = 0.20 / 200;

var TradeController = module.exports = function() {
  if (! (this instanceof TradeController)) { // enforcing new
    return new TradeController();
  }
  this.reset();
};
TradeController.BUY = BUY;
TradeController.SELL = SELL;
TradeController.HOLD = HOLD;
TradeController.OFFSET = OFFSET;
TradeController.OFFSET_POS = 1.0 + OFFSET;
TradeController.OFFSET_NEG = 1.0 - OFFSET;

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

TradeController.prototype.trade = function(close, high, low, open, forceHold) {
  return this.tradeLogic(close, high, low, open, forceHold, this.i < 127, false);
};

TradeController.prototype.tradeLogic = function(mid, high, low, open, forceHold, noSma, debug) {
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
  sma.push(mid);
  // 6-3-3 Stochastic Oscillator
  if (i > 5) {
    var maxUpper = max(upper[i_0], upper[i_1], upper[i_2], upper[i_3], upper[i_4], high);
    var minLower = min(lower[i_0], lower[i_1], lower[i_2], lower[i_3], lower[i_4], low);
    var k = (mid - minLower) / (maxUpper - minLower);
    k = k < 0.0 ? 0.0 : (k > 1.0 ? 1.0 : k);
    ks[i_7] = k;
    var d = this.d - ks[i_2] - ks[i_3] - ks[i_4] + ks[i_5] + ks[i_6] + k;
    this.d = d;
    if (i > 9) {
      if (debug) {
        console.log('k:', k, 'd:', d, 'sma:', sma.ave, 'up:', sma.up, 'down:', sma.down);
      }
      var d_le_80 = d <= 7.2; // 7.2 = 80 / (100 / 3 / 3)
      var d_ge_20 = d >= 1.8; // 1.8 = 20 / (100 / 3 / 3)
      if (this.above && d_le_80 && (noSma || sma.down)) {
        result = SELL;
      } else if (this.below && d_ge_20 && (noSma || sma.up)) {
        result = BUY;
      } else if (!this.below && !d_ge_20) {
        result = SELL;
      }
      this.above = !d_le_80;
      this.below = !d_ge_20;
    }
  }
  return result;
};

if (!module.parent) {
  console.time('a');
  var tradeController = new TradeController();
  var rand = Math.random;
  for (var i = 10000; i--;) {
    tradeController.tradeLogic(rand(), rand(), rand(), rand(), false, true, false);
  }
  console.timeEnd('a');
}
