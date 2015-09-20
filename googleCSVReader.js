var toCent = require('./utils').toCent;
var Technicals = require('./techicals');
var SMA = Technicals.SMA;
var LSS = Technicals.LSS;
var ALSS = Technicals.ALSS;
var EMA = Technicals.EMA;
var DEMA = Technicals.DEMA;
var EMAS= Technicals.EMAS;
var PVALUE = Technicals.PVALUE;
var BOIL = Technicals.BOIL;
var MACD = Technicals.MACD;
var STOCHASTIC = Technicals.STOCHASTIC;
var RSI = Technicals.RSI;

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
  this.sma10  = new SMA(10);
  this.sma20  = new SMA(20);
  this.sma50  = new SMA(50);
  this.sma100 = new SMA(100);
  this.sma200 = new SMA(200);
  this.lss10  = new LSS(10);
  this.lss20  = new LSS(20);
  this.lss50  = new LSS(50);
  this.lss100 = new LSS(100);
  this.lss200 = new LSS(200);
  this.alss10  = new ALSS(10, 4);
  this.alss20  = new ALSS(20, 4);
  this.alss50  = new ALSS(50, 4);
  this.alss100 = new ALSS(100, 4);
  this.alss200 = new ALSS(200, 4);
  this.ema10  = new EMA(10);
  this.ema20  = new EMA(20);
  this.ema50  = new EMA(50);
  this.ema100 = new EMA(100);
  this.ema200 = new EMA(200);
  this.dema10  = new DEMA(10);
  this.dema20  = new DEMA(20);
  this.dema50  = new DEMA(50);
  this.dema100 = new DEMA(100);
  this.dema200 = new DEMA(200);
  this.emas10  = new EMAS(10, 4);
  this.emas20  = new EMAS(20, 4);
  this.emas50  = new EMAS(50, 4);
  this.emas100 = new EMAS(100, 4);
  this.emas200 = new EMAS(200, 4);
  this.PVALUE10  = new PVALUE(10);
  this.PVALUE20  = new PVALUE(20);
  this.PVALUE50  = new PVALUE(50);
  this.PVALUE100 = new PVALUE(100);
  this.PVALUE200 = new PVALUE(200);
  this.BOIL = new BOIL(20);
  this.MACD12  = new MACD(12, 26, 9);
  this.MACD5 = new MACD(5, 35, 5);
  this.STOCHASTIC14 = new STOCHASTIC(14, 3, 3);
  this.STOCHASTIC5 = new STOCHASTIC(5, 3, 3);
  this.RSI = new RSI(14);
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
