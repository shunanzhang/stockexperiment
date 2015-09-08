var rest = require('restler');

var INTERVAL = 60; // sec
var PERIOD = 10; // days
var TICKER = 'GOOG';

var GoogleCSVReader function(data) {
};

var url = ['http://www.google.com/finance/getprices?i=', INTERVAL, '&p=', PERIOD, 'd&f=d,o,h,l,c,v&df=cpct&q=', TICKER.toUpperCase()].join('');
rest.get(url).on('success', function(data) {
  var googleCSVReader = new GoogleCSVReader(data);
  console.log(data);
}).on('fail', function(data) {
  console.error(data);
}).on('error', function(data) {
  console.error(data);
});
