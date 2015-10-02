var toCent = require('./utils').toCent;
var redis = require('./redis');

var DATE_COLUMN = 'DATE';
var CLOSE_COLUMN = 'CLOSE';
var HIGH_COLUMN = 'HIGH';
var LOW_COLUMN = 'LOW';
var OPEN_COLUMN = 'OPEN';
var VOLUME_COLUMN = 'VOLUME';
var COLUMNS = [DATE_COLUMN, CLOSE_COLUMN, HIGH_COLUMN, LOW_COLUMN, OPEN_COLUMN, VOLUME_COLUMN];

var GoogleCSVReader = module.exports = function() {
  if (! (this instanceof GoogleCSVReader)) { // enforcing new
    return new GoogleCSVReader();
  }
  this.columns = {}; // key: name, val: index
  this.data = [];
  this.interval = 0;
  this.basetime = 0;
};
GoogleCSVReader.DATE_COLUMN = DATE_COLUMN;
GoogleCSVReader.CLOSE_COLUMN = CLOSE_COLUMN;
GoogleCSVReader.HIGH_COLUMN = HIGH_COLUMN;
GoogleCSVReader.LOW_COLUMN = LOW_COLUMN;
GoogleCSVReader.OPEN_COLUMN = OPEN_COLUMN;
GoogleCSVReader.VOLUME_COLUMN = VOLUME_COLUMN;

GoogleCSVReader.prototype.parseLine = function(line) {
  if (!line) {
    return;
  }
  line = line.trim();
  var columnsLine = /^COLUMNS=/;
  var intervalLine = /^INTERVAL=/;
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
  } else if (intervalLine.test(line)) {
    this.interval = parseInt(line.replace(intervalLine, ''), 10);
  } else if (basetimeLine.test(line)) {
    this.basetime = parseInt(line.replace(basetimeLine, '').split(',')[0], 10);
  } else if (/^\d/.test(line)) {
    if (!this.basetime || !Object.keys(columns).length || !this.interval) {
      this.shutdown();
      throw new Error('missing basetime or columns ' + line);
    }
    pieces = line.split(',');
    pieces[columns[DATE_COLUMN]] = parseInt(pieces[columns[DATE_COLUMN]], 10) * this.interval + this.basetime;
    pieces[columns[CLOSE_COLUMN]] = toCent(parseFloat(pieces[columns[CLOSE_COLUMN]])); // $12.34 => 1234
    pieces[columns[HIGH_COLUMN]] = toCent(parseFloat(pieces[columns[HIGH_COLUMN]]));
    pieces[columns[LOW_COLUMN]] = toCent(parseFloat(pieces[columns[LOW_COLUMN]]));
    pieces[columns[OPEN_COLUMN]] = toCent(parseFloat(pieces[columns[OPEN_COLUMN]]));
    pieces[columns[VOLUME_COLUMN]] = parseInt(pieces[columns[VOLUME_COLUMN]], 10);
    this.data.push(pieces);
    return pieces;
  }
};

GoogleCSVReader.prototype.getColumnData = function(column) {
  var result = [];
  var columnIndex = this.columns[column];

  if (columnIndex) {
    var data = this.data;
    for (var i = 0, l = data.length; i < l; i++) {
      result.push(data[i][columnIndex]);
    }
  }
  return result;
};

GoogleCSVReader.prototype.save = function(tickerId) {
  redis.saveIntraday(tickerId, DATE_COLUMN, COLUMNS, this.data);
};

GoogleCSVReader.prototype.load = function(tickerId) {
  var loading = true;
  redis.loadIntraday(tickerId, COLUMNS, (function(err, lines) {
    if (err) {
      this.shutdown();
      throw new Error('Redis load error ' + err);
    }
    this.data = lines;
    loading = false;
  }).bind(this));
  while (loading) { // XXX
  }
};

GoogleCSVReader.shutdown = redis.quit.bind(redis);
