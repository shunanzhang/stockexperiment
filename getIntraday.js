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
var PERIOD = 10; // days
var TICKER = 'GOOG';

var BUY = 'buy';
var SELL = 'sell';

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
    if (i >= subarray.start && i <= subarray.end) {
      return true;
    }
  }
  return false;
};

var train = function() {
  //console.log(googleCSVReader);
  var optimalGains = kMaximalGains.getRanges(PERIOD * 2);
  console.log(optimalGains);

  var featureVectorBuilder = new FeatureVectorBuilder();
  var closeColumnIndex = googleCSVReader.columns[CLOSE_COLUMN];
  var highColumnIndex = googleCSVReader.columns[HIGH_COLUMN];
  var lowColumnIndex = googleCSVReader.columns[LOW_COLUMN];
  var openColumnIndex = googleCSVReader.columns[OPEN_COLUMN];
  var volumeColumnIndex = googleCSVReader.columns[VOLUME_COLUMN];
  var data = googleCSVReader.data;
  scw.train(function(trainCallback) {
    for (var i = 0, l = (data.length >> 1); i < l; i++) {
      var datum = data[i];
      var trainingDatum = {
        featureVector: featureVectorBuilder.build(datum[closeColumnIndex], datum[highColumnIndex], datum[lowColumnIndex], datum[openColumnIndex], datum[volumeColumnIndex]),
        category: (isInRange(i, optimalGains) ? BUY : SELL)
      };
      trainCallback(trainingDatum);
    }
  });

  var success = 0;
  var testSize = 0;
  for (var i = (data.length >> 1), l = data.length; i < l; i++) {
    testSize += 1;
    var datum = data[i];
    var featureVector = featureVectorBuilder.build(datum[closeColumnIndex], datum[highColumnIndex], datum[lowColumnIndex], datum[openColumnIndex], datum[volumeColumnIndex]);
    if (testSize < 2) {
      console.log(featureVector);
    }
    console.log(scw.test(featureVector));
    if (scw.test(featureVector) === (isInRange(i, optimalGains) ? BUY: SELL)) {
      success += 1;
    }
  }
  console.log('accuracy:', success, '/', testSize, '=', 100.0 * success / testSize, '%');
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
