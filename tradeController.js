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
  this.clear();
};

TradeController.prototype.clear = function() {
  this.lastPos = HOLD;
  this.lastEntry = 0;
};

TradeController.prototype.tradeWithRealtimeBar = function(realtimeBar, forceHold, lastOrder) {
  var datum = [0, 0, 0, 0, 0]; // contiguous keys starting at 0 for performance
  datum[this.closeColumnIndex] = toCent(realtimeBar.close);
  datum[this.openColumnIndex] = toCent(realtimeBar.open);
  return this.trade(datum, forceHold, lastOrder);
};

TradeController.prototype.trade = function(datum, forceHold, lastOrder) {
  var close = datum[this.closeColumnIndex];
  var open = datum[this.openColumnIndex];
  if (forceHold) {
    this.reset();
    return this.lastPos;
  }
  var takeProfit = 0.00578;
  var cutLoss = 0.00160;
  var cutLossR = 0.00158;
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
    if ((lastPos === HOLD && (lastBar < -entryBar || lastBar > entryBar)) || (lastPos === BUY && (ratio >= takeProfit || ratio <= -cutLoss || barCount < -5)) || (lastPos === SELL && (ratio <= -takeProfit || ratio >= cutLossR || barCount > 5))) {
      if ((lastPos === BUY && close < lastEntry) || (lastPos === SELL && close > lastEntry)) {
        this.contLoss += 1;
      } else if (lastPos !== HOLD) {
        this.contLoss = 0;
      }
      if (this.contLoss > 9) {
        this.clear();
      } else
      if (lastOrder) {
        if ((lastPos === BUY && close > lastEntry) || (lastPos === SELL && close < lastEntry)) {
          this.clear();
        }
      } else if (lastBar > 1) {
        this.lastPos = BUY;
        this.lastEntry = close;
      } else if (lastBar < 0) { // biasing to sell rather than < -1
        this.lastPos = SELL;
        this.lastEntry = close;
      }
    }
  }
  this.lastBar = close - open;
  //console.log(new Date((datum[0] + 60 * 60 * 3 - 60) * 1000).toLocaleTimeString(), close, lastEntry, lastPos);
  return this.lastPos;
};
