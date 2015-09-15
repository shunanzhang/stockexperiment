var request = require('request');
var ByLineStream = require('./byLineStream');
var GoogleCSVReader = require('./googleCSVReader');
var KMaximalGains = require('./kMaximalGains');
var CLOSE_COLUMN = GoogleCSVReader.CLOSE_COLUMN;

var INTERVAL = 60; // sec
var PERIOD = 10; // days
var TICKER = 'GOOG';

var kMaximalSubarrays = new KMaximalGains([]);
var googleCSVReader = new GoogleCSVReader();
var url = ['http://www.google.com/finance/getprices?i=', INTERVAL, '&p=', PERIOD, 'd&f=d,o,h,l,c,v&df=cpct&q=', TICKER.toUpperCase()].join('');

var train = function() {
  //console.log(googleCSVReader);
  console.log(kMaximalSubarrays.getRanges(10));
};

request(url).pipe(new ByLineStream()).on('readable', function() {
  googleCSVReader.parseLine(this.read());
  var data = googleCSVReader.data;
  var len = data.length;
  if (len > 0) {
    var closeColumnIndex = googleCSVReader.columns[CLOSE_COLUMN];
    var close = data[len - 1][closeColumnIndex];
    //console.error(close);
    kMaximalSubarrays.prices.push(close);
  }
}).on('end', train).on('error', function(data) {
  console.error(data);
});
