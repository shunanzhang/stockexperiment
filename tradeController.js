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

var TradeController = module.exports = function(columns) {
  if (! (this instanceof TradeController)) { // enforcing new
    return new TradeController(columns);
  }
  this.featureVectorBuilder = new FeatureVectorBuilder();
  this.closeColumnIndex = columns[CLOSE_COLUMN];
  this.highColumnIndex = columns[HIGH_COLUMN];
  this.lowColumnIndex = columns[LOW_COLUMN];
  this.openColumnIndex = columns[OPEN_COLUMN];
  this.volumeColumnIndex = columns[VOLUME_COLUMN];
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

var countDown = 0;
var lastPos = HOLD;
var HOLDING = 2;
//var HOLDING = 11; // AMZN
var BAND_LOWER_LIMIT = 0.0051; // NFLX
//var BAND_LOWER_LIMIT = 0.0033; // AMZN, FB
var BAND_UPPER_LIMIT = 0.0086;
var BAND_ABOVE_LIMIT = 0.01; // NFLX
//var BAND_ABOVE_LIMIT = 0.0087; // AMZN
TradeController.prototype.trade = function(featureVector, forceHold) {
  if (forceHold) {
    lastPos = HOLD;
    return HOLD;
  }
  var band = featureVector.band;
  if (band) {
    var high = featureVector.high;
    var low = featureVector.low;
    var up = (featureVector.close - featureVector.open) > 0; // NFLX
    var down = (featureVector.close - featureVector.open) < 0; // NFLX
    //var up = true; // AMZN, FB
    //var down = true; // AMZN, FB
    var bandWidth = band.twoSigma / band.ave;
    if (bandWidth > BAND_LOWER_LIMIT) {
      if ((bandWidth > BAND_ABOVE_LIMIT && band.upper < high) || (down && bandWidth < BAND_UPPER_LIMIT && band.lower > low)) {
        countDown = HOLDING;
        lastPos = BUY;
        return BUY;
      }
      if ((bandWidth > BAND_ABOVE_LIMIT && band.lower > low) || (up && bandWidth < BAND_UPPER_LIMIT && band.upper < high)) {
        countDown = HOLDING;
        lastPos = SELL;
        return SELL;
      }
    }
  }
  countDown = Math.max(0, countDown - 1);
  if (countDown > 0) {
    return lastPos;
  }
  lastPos = HOLD;
  return HOLD;
};
