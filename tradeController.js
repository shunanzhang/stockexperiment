var GoogleCSVReader = require('./googleCSVReader');
var CLOSE_COLUMN = GoogleCSVReader.CLOSE_COLUMN;
var HIGH_COLUMN = GoogleCSVReader.HIGH_COLUMN;
var LOW_COLUMN = GoogleCSVReader.LOW_COLUMN;
var OPEN_COLUMN = GoogleCSVReader.OPEN_COLUMN;
var VOLUME_COLUMN = GoogleCSVReader.VOLUME_COLUMN;
var KMaximalGains = require('./kMaximalGains');
var FeatureVectorBuilder = require('./featureVectorBuilder');
var SCW = require('./scw');

var BUY = 'buy';
var SELL = 'sell';

var MINUTES_DAY = 390; // 390 minutes per day (9:30AM - 4:00PM ET)
var TRAIN_INTERVAL = 390;
var TRAINING_DAYS = 17;

var SCW_PARAMS = {
  ETA: 10.0,
  // 100.0
  C: 1.0,
  MODE: 2 // 0, 1, or 2
};

var TradeController = module.exports = function(columns, data, closes) {
  if (! (this instanceof TradeController)) { // enforcing new
    return new TradeController();
  }
  this.scw = new SCW(SCW_PARAMS.ETA, SCW_PARAMS.C, SCW_PARAMS.MODE);
  this.columns = columns;
  this.data = data;
  this.dataLen = data.length;
  this.trainLen = MINUTES_DAY * TRAINING_DAYS;
  this.kMaximal = 3 * TRAINING_DAYS;
  this.closes = closes;
  this.kMaximalGains = new KMaximalGains(closes);
  this.optimalGains = kMaximalGains.getRanges(kMaximal, 0, trainLen - 1);
  this.featureVectorBuilder = new FeatureVectorBuilder();
};

TradeController.prototype.trade = function(datum) {
  var columns = this.columns;
  var closeColumnIndex = columns[CLOSE_COLUMN];
  var highColumnIndex = columns[HIGH_COLUMN];
  var lowColumnIndex = columns[LOW_COLUMN];
  var openColumnIndex = columns[OPEN_COLUMN];
  var volumeColumnIndex = columns[VOLUME_COLUMN];
  var featureVector = this.featureVectorBuilder.build(datum[closeColumnIndex], datum[highColumnIndex], datum[lowColumnIndex], datum[openColumnIndex], datum[volumeColumnIndex]);
  var result = scw.test(featureVector);
  return {
    featureVector: featureVector,
    result: result
  };
};

TradeController.prototype.train = function() {
};
