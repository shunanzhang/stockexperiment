var request = require('request');
var ByLineStream = require('./byLineStream');
var toCent = require('./utils').toCent;

var INTERVAL = 60; // sec
var PERIOD = 10; // days
var TICKER = 'GOOG';
var DATE_COLUMN = 'DATE';
var CLOSE_COLUMN = 'CLOSE';
var HIGH_COLUMN = 'HIGH';
var LOW_COLUMN = 'LOW';
var OPEN_COLUMN = 'OPEN';
var VOLUME_COLUMN = 'VOLUME';
var COLUMNS = [DATE_COLUMN, CLOSE_COLUMN, HIGH_COLUMN, LOW_COLUMN, OPEN_COLUMN, VOLUME_COLUMN];

var GoogleCSVReader = function() {
  this.columns = {}; // key: name, val: index
  this.data = [];
  this.basetime = 0;
};
GoogleCSVReader.prototype.parseLine = function(line) {
  if (!line) {
    return;
  }
  line = line.trim();
  var columnsLine = /^COLUMNS=/;
  var basetimeLine = /^a/;
  var columns = this.columns;
  var pieces = [];
  if (columnsLine.test(line)) {
    columns = this.columns = {};
    pieces = line.replace(columnsLine, '').split(',');
    for (var i = pieces.length; i--;) {
      columns[pieces[i]] = i;
    }
    for (i = COLUMNS.length; i--;) {
      if (!columns.hasOwnProperty(COLUMNS[i])) {
        throw new Error('Invalid columns ' + line);
      }
    }
  } else if (basetimeLine.test(line)) {
    this.basetime = parseInt(line.replace(basetimeLine, '').split(',')[0], 10);
  } else if (/^\d/.test(line)) {
    if (!this.basetime || !Object.keys(columns).length) {
      throw new Error('missing basetime or columns ' + line);
    }
    pieces = line.split(',');
    pieces[columns[DATE_COLUMN]] = parseInt(pieces[columns[DATE_COLUMN]], 10) * INTERVAL + this.basetime;
    pieces[columns[CLOSE_COLUMN]] = toCent(parseFloat(pieces[columns[CLOSE_COLUMN]])); // $12.34 => 1234
    pieces[columns[HIGH_COLUMN]] = toCent(parseFloat(pieces[columns[HIGH_COLUMN]]));
    pieces[columns[LOW_COLUMN]] = toCent(parseFloat(pieces[columns[LOW_COLUMN]]));
    pieces[columns[OPEN_COLUMN]] = toCent(parseFloat(pieces[columns[OPEN_COLUMN]]));
    pieces[columns[VOLUME_COLUMN]] = parseInt(pieces[columns[VOLUME_COLUMN]], 10);
    this.data.push(pieces);
  }
};


var googleCSVReader = new GoogleCSVReader();
var url = ['http://www.google.com/finance/getprices?i=', INTERVAL, '&p=', PERIOD, 'd&f=d,o,h,l,c,v&df=cpct&q=', TICKER.toUpperCase()].join('');
var train = function() {
  console.log(googleCSVReader);
};

request(url).pipe(new ByLineStream()).on('readable', function() {
  googleCSVReader.parseLine(this.read());
}).on('end', train).on('error', function(data) {
  console.error(data);
});
