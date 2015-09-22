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

var kMaximalGains = new KMaximalGains([]);
var googleCSVReader = new GoogleCSVReader();
var url = ['http://www.google.com/finance/getprices?i=', INTERVAL, '&p=', PERIOD, 'd&f=d,o,h,l,c,v&df=cpct&q=', TICKER.toUpperCase()].join('');

var train = function() {
  //console.log(googleCSVReader);
  console.log(kMaximalGains.getRanges(10));
  var scw = new SCW();
  var featureVectorBuilder = new FeatureVectorBuilder();
  var closeColumnIndex = googleCSVReader.columns[CLOSE_COLUMN];
  var highColumnIndex = googleCSVReader.columns[HIGH_COLUMN];
  var lowColumnIndex = googleCSVReader.columns[LOW_COLUMN];
  var openColumnIndex = googleCSVReader.columns[OPEN_COLUMN];
  var volumeColumnIndex = googleCSVReader.columns[VOLUME_COLUMN];
  var data = googleCSVReader.data;
  for (var i = 0, l = data.length; i < l; i++) {
    var datum = data[i];
    var featureVector = featureVectorBuilder.build(datum[closeColumnIndex], datum[highColumnIndex], datum[lowColumnIndex], datum[openColumnIndex], datum[volumeColumnIndex]);
  }
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
