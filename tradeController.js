var GoogleCSVReader = require('./googleCSVReader');
var CLOSE_COLUMN = GoogleCSVReader.CLOSE_COLUMN;
var HIGH_COLUMN = GoogleCSVReader.HIGH_COLUMN;
var LOW_COLUMN = GoogleCSVReader.LOW_COLUMN;
var OPEN_COLUMN = GoogleCSVReader.OPEN_COLUMN;
var toCent = require('./utils').toCent;
var BOL = require('./technicals').BOL;

var BUY = 'buy';
var SELL = 'sell';
var HOLD = 'hold';

var MINUTES_DAY = 390; // 390 minutes per day (9:30AM - 4:00PM ET)

var BAND_LIMIT = {
  //NFLX: {
  //  lower: 0.00510,
  //  upper: 0.00859,
  //  bull: 1,
  //  bear: -3
  //},
  NFLX: {
    lower: 0.00707,
    upper: 0.00750,
    bull: 0,
    bear: -0
  },
  SPY: {
    lower: 0.00434,
    upper: 0.00521,
    bull: 0,
    bear: -0
  },
  AAPL: {
    lower: 0.00239,
    upper: 0.00905,
    bull: 1,
    bear: -0
  },
  FB: {
    lower: 0.00337,
    upper: 0.00759,
    bull: 2,
    bear: -1
  },
  AMZN: {
    lower: 0.00330,
    upper: 0.01007,
    bull: 4,
    bear: -4
  },
  GOOG: {
    lower: 0.00240,
    upper: 0.00700,
    bull: 4,
    bear: -4
  },
  TSLA: {
    lower: 0.00312,
    upper: 0.00758,
    bull: 4,
    bear: -6
  },
  BIDU: {
    lower: 0.00314,
    upper: 0.00721,
    bull: 3,
    bear: -5
  },
  GS: {
    lower: 0.00093,
    upper: 0.00567,
    bull: 5,
    bear: -0
  },
  CRM: {
    lower: 0.00543,
    upper: 0.00767,
    bull: 0,
    bear: -0
  },
  GOOGL: {
    lower: 0.00210,
    upper: 0.00780,
    bull: 6,
    bear: -4
  }
};

var abs = Math.abs;

var TradeController = module.exports = function(columns, symbol, holding) {
  if (! (this instanceof TradeController)) { // enforcing new
    return new TradeController(columns, symbol, holding);
  }
  this.closeColumnIndex = columns[CLOSE_COLUMN];
  this.highColumnIndex = columns[HIGH_COLUMN];
  this.lowColumnIndex = columns[LOW_COLUMN];
  this.openColumnIndex = columns[OPEN_COLUMN];
  var bandLimit = BAND_LIMIT[symbol] || BAND_LIMIT.NFLX;
  this.lowerLimit = bandLimit.lower;
  this.upperLimit = bandLimit.upper;
  this.bullLimit = bandLimit.bull;
  this.bearLimit = bandLimit.bear;
  this.holding = holding || 2;
  this.countDown = 0;
  this.lastPos = HOLD;
  this.bol = new BOL(20);
};
TradeController.BUY = BUY;
TradeController.SELL = SELL;
TradeController.HOLD = HOLD;
TradeController.MINUTES_DAY = MINUTES_DAY;

TradeController.prototype.tradeWithRealtimeBar = function(realtimeBar, forceHold) {
  var datum = [0]; // contiguous keys starting at 0 for performance
  datum[this.closeColumnIndex] = toCent(realtimeBar.close);
  datum[this.highColumnIndex] = toCent(realtimeBar.high);
  datum[this.lowColumnIndex] = toCent(realtimeBar.low);
  datum[this.openColumnIndex] = toCent(realtimeBar.open);
  return this.trade(datum, forceHold);
};

TradeController.prototype.trade = function(datum, forceHold) {
  var close = datum[this.closeColumnIndex];
  var high = datum[this.highColumnIndex];
  var low = datum[this.lowColumnIndex];
  var open = datum[this.openColumnIndex];
  var band = this.bol.analize(close);
  if (forceHold || !band) {
    this.lastPos = HOLD;
    this.countDown = 0;
    return HOLD;
  }
  var bandWidth = band.width;
  var bar = close - open;
  console.log(new Date(), close, high, low, open, bandWidth, bar, band.lower, band.upper);
  if (this.lowerLimit < bandWidth && bandWidth < this.upperLimit && abs(bar) < band.twoSigma) {
    if (bar < this.bearLimit && low < band.lower) {
      this.countDown = this.holding;
      this.lastPos = BUY;
      return BUY;
    } else if (bar > this.bullLimit && high > band.upper) {
      this.countDown = this.holding;
      this.lastPos = SELL;
      return SELL;
    }
  }
  if (--this.countDown <= 0) {
    this.lastPos = HOLD;
    this.countDown = 0;
  }
  return this.lastPos;
};
