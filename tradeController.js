var GoogleCSVReader = require('./googleCSVReader');
var CLOSE_COLUMN = GoogleCSVReader.CLOSE_COLUMN;
var HIGH_COLUMN = GoogleCSVReader.HIGH_COLUMN;
var LOW_COLUMN = GoogleCSVReader.LOW_COLUMN;
var OPEN_COLUMN = GoogleCSVReader.OPEN_COLUMN;
var VOLUME_COLUMN = GoogleCSVReader.VOLUME_COLUMN;
var KMaximalGains = require('./kMaximalGains');
var FeatureVectorBuilder = require('./featureVectorBuilder');
var SCW = require('./scw');
var toCent = require('./utils').toCent;

var BUY = 'buy';
var SELL = 'sell';
var HOLD = 'hold';

var MINUTES_DAY = 390; // 390 minutes per day (9:30AM - 4:00PM ET)
var TRAIN_INTERVAL = 390;
var TRAINING_DAYS = 17;
var TRAIN_LEN = MINUTES_DAY * TRAINING_DAYS;
var K = 3 * TRAINING_DAYS;

var SCW_PARAMS = {
  ETA: 10.0,
  // 100.0
  C: 1.0,
  MODE: 2 // 0, 1, or 2
};

var TradeController = module.exports = function(columns, closes) {
  if (! (this instanceof TradeController)) { // enforcing new
    return new TradeController(columns, closes);
  }
  this.scw = new SCW(SCW_PARAMS.ETA, SCW_PARAMS.C, SCW_PARAMS.MODE);
  this.kMaximalGains = new KMaximalGains(closes);
  this.featureVectorBuilder = new FeatureVectorBuilder();
  this.closeColumnIndex = columns[CLOSE_COLUMN];
  this.highColumnIndex = columns[HIGH_COLUMN];
  this.lowColumnIndex = columns[LOW_COLUMN];
  this.openColumnIndex = columns[OPEN_COLUMN];
  this.volumeColumnIndex = columns[VOLUME_COLUMN];
  //var reverseCloses = [];
  //for (var i = closes.length; i--;) {
  //  reverseCloses[i] = 10000000 - closes[i];
  //}
  //this.kMaximalLosses = new KMaximalGains(reverseCloses);
};
TradeController.BUY = BUY;
TradeController.SELL = SELL;
TradeController.HOLD = HOLD;
TradeController.MINUTES_DAY = MINUTES_DAY;
TradeController.TRAIN_INTERVAL = TRAIN_INTERVAL;
TradeController.TRAIN_LEN = TRAIN_LEN;

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
  return forceHold ? HOLD : this.scw.test(featureVector);
};

TradeController.prototype.supervise = function(i) {
  this.kMaximalGains.getOptimal(K, i - TRAIN_LEN + 1, i);
  //this.kMaximalLosses.getOptimal(K, i - TRAIN_LEN + 1, i);
};

TradeController.prototype.train = function(i_j, featureVector) {
  var correctResult = this.kMaximalGains.isInRange(i_j, BUY, HOLD);
  //if (correctResult === HOLD) {
  //  correctResult = this.kMaximalLosses.isInRange(i_j, SELL, HOLD);
  //}
  this.scw.update({
    featureVector: featureVector,
    category: correctResult
  });
  return correctResult;
};
