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
var DAILY_MIN = 390; // 390 minutes per day

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
      return true;
    }
  }
  return false;
};

var train = function() {
  var data = googleCSVReader.data;
  var dataLen = data.length;
  var dataLenTraining = dataLen >> 1;
  var optimalGains = kMaximalGains.getRanges((3 * dataLenTraining / DAILY_MIN) | 0, 0, dataLenTraining - 1 + 390);
  console.log(optimalGains);

  var success = 0;
  var testSize = 0;
  var tp = 0;
  var fp = 0;
  var fn = 0;
  var bought = 0;
  var gain = 0 ;
  var featureVectorBuilder = new FeatureVectorBuilder();
  var closeColumnIndex = googleCSVReader.columns[CLOSE_COLUMN];
  var highColumnIndex = googleCSVReader.columns[HIGH_COLUMN];
  var lowColumnIndex = googleCSVReader.columns[LOW_COLUMN];
  var openColumnIndex = googleCSVReader.columns[OPEN_COLUMN];
  var volumeColumnIndex = googleCSVReader.columns[VOLUME_COLUMN];
  for (var i = 0; i < dataLen; i++) {
    var datum = data[i];
    var featureVector = featureVectorBuilder.build(datum[closeColumnIndex], datum[highColumnIndex], datum[lowColumnIndex], datum[openColumnIndex], datum[volumeColumnIndex]);
    var correctResult = (isInRange(i, optimalGains) ? BUY: SELL);
    if (i >= dataLenTraining) {
      testSize += 1;
      optimalGains = kMaximalGains.getRanges((3 * dataLenTraining / DAILY_MIN) | 0, i - dataLenTraining + 1, i + 390);
      correctResult = (isInRange(i, optimalGains) ? BUY: SELL);
      //console.log(i, optimalGains);
      var result = scw.test(featureVector);
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
      if (result === BUY && bought === 0) {
        bought = datum[closeColumnIndex];
      } else if (result === SELL && bought > 0) {
        gain += datum[closeColumnIndex] - bought;
        bought = 0;
      }
    }
    var trainingDatum = {
      featureVector: featureVector,
      category: correctResult
    };
    scw.update(trainingDatum);
  }
  var precision = tp / (tp + fp);
  var recall = tp / (tp + fn);
  console.log(TICKER);
  console.log('accuracy:', success, '/', testSize, '=', 100.0 * success / testSize, '%');
  console.log('precision:', tp, '/(', tp, '+', fp, ') =', 100.0 * precision, '%');
  console.log('recall:', tp, '/(', tp, '+', fn, ') =', 100.0 * recall, '%');
  console.log('f1 score: =', 200.0 * precision * recall / (precision + recall), '%');
  console.log('gain:', gain, '=', 100.0 * gain / data[data.length - 1][closeColumnIndex], '%');
  console.log('buy and hold:', data[data.length - 1][closeColumnIndex] - data[data.length >> 1][closeColumnIndex]);
};

request(url).pipe(new ByLineStream()).on('readable', function() {
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
