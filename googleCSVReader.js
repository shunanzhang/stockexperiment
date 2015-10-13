var toCent = require('./utils').toCent;
var redis = require('./redis');

var DATE_COLUMN = 'DATE';
var CLOSE_COLUMN = 'CLOSE';
var HIGH_COLUMN = 'HIGH';
var LOW_COLUMN = 'LOW';
var OPEN_COLUMN = 'OPEN';
var VOLUME_COLUMN = 'VOLUME';
var COLUMNS = [DATE_COLUMN, CLOSE_COLUMN, HIGH_COLUMN, LOW_COLUMN, OPEN_COLUMN, VOLUME_COLUMN];

var GoogleCSVReader = module.exports = function(tickerId) {
  if (! (this instanceof GoogleCSVReader)) { // enforcing new
    return new GoogleCSVReader();
  }
  this.tickerId = tickerId;
  this._columns = {}; // key: name, val: index
  this.columns = {}; // key: name, val: index
  this.data = [];
  this.interval = 0;
  this.basetime = 0;
  for (var i = COLUMNS.length; i--;) {
    this.columns[COLUMNS[i]] = i;
  }
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
  var _columns = this._columns;
  var columns = this.columns;
  var pieces = [];
  if (columnsLine.test(line)) {
    _columns = this._columns = {};
    pieces = line.replace(columnsLine, '').split(',');
    for (var i = pieces.length; i--;) {
      _columns[pieces[i]] = i;
    }
    for (i = COLUMNS.length; i--;) {
      if (!_columns.hasOwnProperty(COLUMNS[i])) {
        throw new Error('Invalid columns ' + line);
      }
    }
  } else if (intervalLine.test(line)) {
    this.interval = parseInt(line.replace(intervalLine, ''), 10);
  } else if (basetimeLine.test(line)) {
    this.basetime = parseInt(line.replace(basetimeLine, '').split(',')[0], 10);
  } else if (/^\d/.test(line)) {
    if (!this.basetime || !Object.keys(_columns).length || !this.interval) {
      this.shutdown();
      throw new Error('missing basetime or columns ' + line);
    }
    pieces = line.split(',');
    var orderdPieces = [];
    orderdPieces[columns[DATE_COLUMN]] = parseInt(pieces[_columns[DATE_COLUMN]], 10) * this.interval + this.basetime;
    orderdPieces[columns[CLOSE_COLUMN]] = toCent(parseFloat(pieces[_columns[CLOSE_COLUMN]])); // $12.34 => 1234
    orderdPieces[columns[HIGH_COLUMN]] = toCent(parseFloat(pieces[_columns[HIGH_COLUMN]]));
    orderdPieces[columns[LOW_COLUMN]] = toCent(parseFloat(pieces[_columns[LOW_COLUMN]]));
    orderdPieces[columns[OPEN_COLUMN]] = toCent(parseFloat(pieces[_columns[OPEN_COLUMN]]));
    orderdPieces[columns[VOLUME_COLUMN]] = parseInt(pieces[_columns[VOLUME_COLUMN]], 10);
    this.data.push(orderdPieces);
    return pieces;
  }
};

GoogleCSVReader.prototype.getColumnData = function(column) {
  var result = [];
  var columnIndex = this.columns[column];

  if (columnIndex) {
    var data = this.data;
    for (var i = data.length; i--;) {
      result[i] = data[i][columnIndex];
    }
  }
  return result;
};

GoogleCSVReader.prototype.save = function() {
  redis.saveIntraday(this.tickerId, this.columns[DATE_COLUMN], this.data);
};

GoogleCSVReader.prototype.load = function(callback) {
  redis.loadIntraday(this.tickerId, (function(err, lines) {
    if (err) {
      this.shutdown();
      throw new Error('Redis load error ' + err);
    }
    var columnIndex = this.columns[DATE_COLUMN];
    var i = 0;
    for (var l = lines.length; i < l; i++) {
      var date = new Date(parseInt(lines[i][columnIndex], 10) * 1000);
      if (date.getUTCHours() === 13 && date.getUTCMinutes() === 31) {
        break;
      }
    }
    lines.splice(i, i);
    console.log(i);
    this.data = lines;
    callback();
  }).bind(this));
};

GoogleCSVReader.prototype.shutdown = redis.quit.bind(redis);
