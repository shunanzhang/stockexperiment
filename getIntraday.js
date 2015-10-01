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
var TICKER = 'NFLX';

var BUY = 'buy';
var SELL = 'sell';

var MINUTES_DAY = 390; // 390 minutes per day (9:30AM - 4:00PM ET)

var SCW_PARAMS = {
  ETA: 10.0,
  // 100.0
  C: 1.0,
  MODE: 2 // 0, 1, or 2
};

var kMaximalGains = new KMaximalGains([]);
var googleCSVReader = new GoogleCSVReader();
var url = ['http://www.google.com/finance/getprices?i=', INTERVAL, '&p=', PERIOD, 'd&f=d,o,h,l,c,v&df=cpct&q=', TICKER.toUpperCase()].join('');
var scw = new SCW(SCW_PARAMS.ETA, SCW_PARAMS.C, SCW_PARAMS.MODE);

var isInRange = function(i, subarrays) {
  for (var j = subarrays.length; j--;) {
    var subarray = subarrays[j];
    if (i >= subarray.start && i < subarray.end) {
      return BUY;
    }
  }
  return SELL;
};

var train = function() {
  var data = googleCSVReader.data;
  var dataLen = data.length;
  var initialTrainingDays = 7;
  var trainLen = MINUTES_DAY * initialTrainingDays;
  var kMaximal = 3 * initialTrainingDays;
  var optimalGains = kMaximalGains.getRanges(kMaximal, 0, trainLen - 1);
  console.log(optimalGains);
  var trainInterval = 390;

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
    var isTraining = (i % trainInterval === trainInterval - 1);
    var result = '';
    featureVectorHistory.push(featureVector);
    if (i >= trainLen) {
      result = scw.test(featureVector);
      resultHistory.push(result);
      if (result === BUY && bought === 0) {
        bought = datum[closeColumnIndex];
      } else if (result === SELL && bought > 0) {
        gain += datum[closeColumnIndex] - bought;
        bought = 0;
      }
      if (isTraining) {
        optimalGains = kMaximalGains.getRanges(kMaximal, i - trainLen + 1, i);
        //console.log(i - trainLen + 1, i, optimalGains);
      }
    }
    if (isTraining) {
      for (var j = trainInterval; j--;) {
        var correctResult = isInRange(i - j, optimalGains);
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
  console.log(TICKER);
  console.log('accuracy:', success, '/', testSize, '=', 100.0 * success / testSize, '%');
  console.log('precision:', tp, '/(', tp, '+', fp, ') =', 100.0 * precision, '%');
  console.log('recall:', tp, '/(', tp, '+', fn, ') =', 100.0 * recall, '%');
  console.log('f1 score: =', 200.0 * precision * recall / (precision + recall), '%');
  console.log('gain:', gain, ', per day =', 100.0 * gain / data[data.length - 1][closeColumnIndex] / (dataLen - trainLen) * MINUTES_DAY, '%');
  console.log('buy and hold:', data[dataLen - 1][closeColumnIndex] - data[trainLen][closeColumnIndex]);
};

//request(url)
fs.createReadStream(__dirname + '/nflx20150927.txt')
//fs.createReadStream(__dirname + '/nflx20151001.txt')
.pipe(new ByLineStream()).on('readable', function() {
  var lineData = googleCSVReader.parseLine(this.read());
  if (lineData) {
    var closeColumnIndex = googleCSVReader.columns[CLOSE_COLUMN];
    var close = lineData[closeColumnIndex];
    //console.error(close);
    kMaximalGains.prices.push(close);
  }
}).on('end', train).on('error', function(data) {
  console.error(data);
});
