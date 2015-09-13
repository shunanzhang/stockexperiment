var request = require('request');
var ByLineStream = require('./byLineStream');
var GoogleCSVReader = require('./googleCSVReader');
var KMaximalSubarrays = require('./kMaximalSubarrays');
var CLOSE_COLUMN = GoogleCSVReader.CLOSE_COLUMN;

var INTERVAL = 60; // sec
var PERIOD = 10; // days
var TICKER = 'GOOG';


var googleCSVReader = new GoogleCSVReader();
var url = ['http://www.google.com/finance/getprices?i=', INTERVAL, '&p=', PERIOD, 'd&f=d,o,h,l,c,v&df=cpct&q=', TICKER.toUpperCase()].join('');
var train = function() {
  //console.log(googleCSVReader);
  var closeColumnIndex = googleCSVReader.columns[CLOSE_COLUMN];
  var data = googleCSVReader.data;
  var prevClose = data[0][closeColumnIndex];
  console.log('init price:' + prevClose);
  var close = 0;
  var gains = [];
  for (var i = 1, l = data.length; i < l; i++) {
    close = data[i][closeColumnIndex];
    gains.push(close - prevClose);
    prevClose = close;
  }
  console.log(gains);
  var kMaximalSubarrays = new KMaximalSubarrays(gains);
  console.log(kMaximalSubarrays.getRanges(10));
};

request(url).pipe(new ByLineStream()).on('readable', function() {
  googleCSVReader.parseLine(this.read());
}).on('end', train).on('error', function(data) {
  console.error(data);
});
