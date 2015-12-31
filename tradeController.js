var GoogleCSVReader = require('./googleCSVReader');
var CLOSE_COLUMN = GoogleCSVReader.CLOSE_COLUMN;
var HIGH_COLUMN = GoogleCSVReader.HIGH_COLUMN;
var LOW_COLUMN = GoogleCSVReader.LOW_COLUMN;
var OPEN_COLUMN = GoogleCSVReader.OPEN_COLUMN;
var VOLUME_COLUMN = GoogleCSVReader.VOLUME_COLUMN;
var FeatureVectorBuilder = require('./featureVectorBuilder');
var toCent = require('./utils').toCent;

var BUY = 'buy';
var SELL = 'sell';
var HOLD = 'hold';

var MINUTES_DAY = 390; // 390 minutes per day (9:30AM - 4:00PM ET)

var BAND_LIMIT = {
  NFLX: {
    lower: 0.00510,
    upper: 0.00859,
    bull: 1,
    bear: -3
  },
  AAPL: {
    lower: 0.00251,
    upper: 0.00905,
    bull: 1,
    bear: -4
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
  JNJ: {
    lower: 0.00322,
    upper: 0.00759,
    bull: 1,
    bear: -1
  }
};

var max = Math.max;

var TradeController = module.exports = function(columns, symbol, holding) {
  if (! (this instanceof TradeController)) { // enforcing new
    return new TradeController(columns, symbol, holding);
  }
  this.featureVectorBuilder = new FeatureVectorBuilder();
  this.closeColumnIndex = columns[CLOSE_COLUMN];
  this.highColumnIndex = columns[HIGH_COLUMN];
  this.lowColumnIndex = columns[LOW_COLUMN];
  this.openColumnIndex = columns[OPEN_COLUMN];
  this.volumeColumnIndex = columns[VOLUME_COLUMN];
  var bandLimit = BAND_LIMIT[symbol] || BAND_LIMIT.NFLX;
  this.lowerLimit = bandLimit.lower;
  this.upperLimit = bandLimit.upper;
  this.bullLimit = bandLimit.bull;
  this.bearLimit = bandLimit.bear;
  this.holding = holding || 2;
  this.countDown = 0;
  this.lastPos = HOLD;
};
TradeController.BUY = BUY;
TradeController.SELL = SELL;
TradeController.HOLD = HOLD;
TradeController.MINUTES_DAY = MINUTES_DAY;

TradeController.prototype.getFeatureVector = function(datum) {
  return this.featureVectorBuilder.build(datum[this.closeColumnIndex], datum[this.highColumnIndex], datum[this.lowColumnIndex], datum[this.openColumnIndex], datum[this.volumeColumnIndex]);
};

TradeController.prototype.getFeatureVectorFromRaltimeBar = function(realtimeBar) {
  var datum = [];
  datum[this.closeColumnIndex] = toCent(realtimeBar.close);
  datum[this.highColumnIndex] = toCent(realtimeBar.high);
  datum[this.lowColumnIndex] = toCent(realtimeBar.low);
  datum[this.openColumnIndex] = toCent(realtimeBar.open);
  datum[this.volumeColumnIndex] = realtimeBar.volume;
  return this.getFeatureVector(datum);
};

TradeController.prototype.trade = function(featureVector, forceHold) {
  if (forceHold) {
    this.lastPos = HOLD;
    return HOLD;
  }
  var band = featureVector.band;
  if (band) {
    var bandWidth = band.width;
    if (this.lowerLimit < bandWidth && bandWidth < this.upperLimit) {
      var bar = featureVector.bar;
      if (bar < this.bearLimit && featureVector.low < band.lower) {
        this.countDown = this.holding;
        this.lastPos = BUY;
        return BUY;
      } else if (bar > this.bullLimit && featureVector.high > band.upper) {
        this.countDown = this.holding;
        this.lastPos = SELL;
        return SELL;
      }
    }
  }
  this.countDown = max(0, this.countDown - 1);
  if (this.countDown > 0) {
    return this.lastPos;
  }
  this.lastPos = HOLD;
  return HOLD;
};
