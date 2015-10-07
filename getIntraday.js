var fs = require('fs');
var request = require('request');
var ByLineStream = require('./byLineStream');
var GoogleCSVReader = require('./googleCSVReader');
var CLOSE_COLUMN = GoogleCSVReader.CLOSE_COLUMN;
var HIGH_COLUMN = GoogleCSVReader.HIGH_COLUMN;
var LOW_COLUMN = GoogleCSVReader.LOW_COLUMN;
var OPEN_COLUMN = GoogleCSVReader.OPEN_COLUMN;
var VOLUME_COLUMN = GoogleCSVReader.VOLUME_COLUMN;
var KMaximalGains = require('./kMaximalGains');
var FeatureVectorBuilder = require('./featureVectorBuilder');
var SCW = require('./scw');

var INTERVAL = 60; // sec
var PERIOD = 20; // days

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

/**
 * argument parsing
 */
var tickerId = process.argv[2] || 'NFLX';
var readNewData = process.argv[3];

var googleCSVReader = new GoogleCSVReader(tickerId);
var url = ['http://www.google.com/finance/getprices?i=', INTERVAL, '&p=', PERIOD, 'd&f=d,o,h,l,c,v&df=cpct&q=', tickerId.toUpperCase()].join('');

var backtest = function() {
  var scw = new SCW(SCW_PARAMS.ETA, SCW_PARAMS.C, SCW_PARAMS.MODE);
  var data = googleCSVReader.data;
  var dataLen = data.length;
  var trainLen = MINUTES_DAY * TRAINING_DAYS;
  var kMaximal = 3 * TRAINING_DAYS;
  var closes = googleCSVReader.getColumnData(CLOSE_COLUMN);
  var kMaximalGains = new KMaximalGains(closes);
  var optimalGains = kMaximalGains.getRanges(kMaximal, 0, trainLen - 1);
  console.log(optimalGains);

  var success = 0;
  var testSize = 0;
  var tp = 0;
  var fp = 0;
  var fn = 0;
  var bought = 0;
  var gain = 0;
  var featureVectorBuilder = new FeatureVectorBuilder();
  var closeColumnIndex = googleCSVReader.columns[CLOSE_COLUMN];
  var highColumnIndex = googleCSVReader.columns[HIGH_COLUMN];
  var lowColumnIndex = googleCSVReader.columns[LOW_COLUMN];
  var openColumnIndex = googleCSVReader.columns[OPEN_COLUMN];
  var volumeColumnIndex = googleCSVReader.columns[VOLUME_COLUMN];
  var featureVectorHistory = [];
  var resultHistory = [];
  for (var i = 0; i < dataLen; i++) {
    var datum = data[i];
    var featureVector = featureVectorBuilder.build(datum[closeColumnIndex], datum[highColumnIndex], datum[lowColumnIndex], datum[openColumnIndex], datum[volumeColumnIndex]);
    var isTraining = (i % TRAIN_INTERVAL === TRAIN_INTERVAL - 1) || (i === dataLen - 1);
    var result = '';
    featureVectorHistory.push(featureVector);
    if (i >= trainLen) {
      result = scw.test(featureVector);
      if (isTraining) {
        result = SELL; // always sell a the end of the day
      }
      resultHistory.push(result);
      if (result === BUY && bought === 0) {
        bought = datum[closeColumnIndex];
        console.log(BUY, i, bought);
      } else if (result === SELL && bought > 0) {
        gain += datum[closeColumnIndex] - bought;
        console.log(SELL, i, datum[closeColumnIndex], datum[closeColumnIndex] - bought);
        bought = 0;
      }
      if (isTraining) {
        kMaximalGains.getRanges(kMaximal, i - trainLen + 1, i);
      }
    }
    if (isTraining) {
      for (var j = TRAIN_INTERVAL; j--;) {
        var correctResult = kMaximalGains.isInRange(i - j, BUY, SELL);
        result = resultHistory.shift();
        if (result) {
          testSize += 1;
          if (result === correctResult) {
            success += 1;
            if (result === BUY) {
              tp += 1;
            }
          } else {
            if (result === BUY) {
              fp += 1;
            } else if (result === SELL) {
              fn += 1;
            }
          }
        }
        scw.update({
          featureVector: featureVectorHistory.shift(),
          category: correctResult
        });
      }
    }
  }
  var precision = tp / (tp + fp);
  var recall = tp / (tp + fn);
  console.log(tickerId);
  console.log('accuracy:', success, '/', testSize, '=', 100.0 * success / testSize, '%');
  console.log('precision:', tp, '/(', tp, '+', fp, ') =', 100.0 * precision, '%');
  console.log('recall:', tp, '/(', tp, '+', fn, ') =', 100.0 * recall, '%');
  console.log('f1 score: =', 200.0 * precision * recall / (precision + recall), '%');
  console.log('days:', (dataLen - trainLen) / MINUTES_DAY);
  console.log('gain:', gain, ', per day =', 100.0 * gain / closes[trainLen] / (dataLen - trainLen) * MINUTES_DAY, '%');
  console.log('buy and hold:', closes[dataLen - 1] - closes[trainLen]);

  googleCSVReader.shutdown();
};

var loadAndBacktest = function() {
  googleCSVReader.load(backtest);
};

if (readNewData) {
  request(url)
  //fs.createReadStream(__dirname + '/nflx20150927.txt')
  //fs.createReadStream(__dirname + '/nflx20151001.txt')
  .pipe(new ByLineStream()).on('readable', function() {
    googleCSVReader.parseLine(this.read());
  }).on('end', function() {
    googleCSVReader.save();
    loadAndBacktest();
  }).on('error', function(data) {
    googleCSVReader.shutdown();
    console.error(data);
  });
} else {
  loadAndBacktest();
}
