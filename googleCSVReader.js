var moment = require('moment-timezone');
var toCent = require('./utils').toCent;
var redis;

var DATE_COLUMN = 'DATE';
var CLOSE_COLUMN = 'CLOSE';
var HIGH_COLUMN = 'HIGH';
var LOW_COLUMN = 'LOW';
var OPEN_COLUMN = 'OPEN';
var VOLUME_COLUMN = 'VOLUME';
var COLUMNS = [DATE_COLUMN, CLOSE_COLUMN, HIGH_COLUMN, LOW_COLUMN, OPEN_COLUMN, VOLUME_COLUMN];
var TIMEZONE = 'America/New_York';

var initRedis = function() {
  if (!redis) {
    redis = require('./redis');
  }
  return redis;
};

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
GoogleCSVReader.TIMEZONE = TIMEZONE;

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
  initRedis().saveIntraday(this.tickerId, this.columns[DATE_COLUMN], this.data);
};

GoogleCSVReader.prototype.load = function(callback) {
  initRedis().loadIntraday(this.tickerId, (function(err, lines) {
    if (err) {
      this.shutdown();
      throw new Error('Redis load error ' + err);
    }
    var columnIndex = this.columns[DATE_COLUMN];
    var i = 390 * 0;
    var date;
    var day = 0;
    for (var l = lines.length; i < l; i++) {
      date = moment.tz(parseInt(lines[i][columnIndex], 10) * 1000, TIMEZONE);
      if (date.hours() === 9 && date.minutes() === 31) {
        day = date.date();
        break;
      }
    }
    lines.splice(0, i);
    var baseTime = 0;
    for (i = 0; i < lines.length; i++) {
      var currTime = parseInt(lines[i][columnIndex], 10);
      date = moment.tz(currTime * 1000, TIMEZONE);
      if (date.date() !== day && moment.tz(baseTime * 1000, TIMEZONE).hours() !== 16) {
        // do nothing
      } else if (date.hours() === 9 && date.minutes() === 31) {
        baseTime = currTime;
        day = date.date();
        continue;
      } else if (date.date() !== day) {
        baseTime = date.hours(9).minutes(31).unix();
        day = date.date();
        lines[i][columnIndex] = baseTime;
        continue;
      }
      baseTime += 60; // TODO parameterize 60
      if (baseTime !== currTime) {
        lines.splice(i, 0, lines[i - 1]); // interpolate
        lines[i][columnIndex] = baseTime;
      }
    }
    var removeDays = 0;
    lines.splice(lines.length - 390 * removeDays, 390 * removeDays);
    this.data = lines;
    callback();
  }).bind(this));
};

GoogleCSVReader.prototype.shutdown = function() {
  initRedis().quit();
};
