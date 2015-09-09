// TODO use ES6 class
var Queue = require('./queue');
var Ema = require('./ema');

var Technical = function() {
  if (! (this instanceof Technical)) { // enforcing new
    return new Technical();
  }
};
Technical.prototype.reset = function() {
  for (var prop in this) {
    if (this.hasOwnProperty(prop) && this[prop].reset) {
      this[prop].reset();
    }
  }
};
Technical.prototype.analize = function() {
  throw new Error('Technical.prototype.analize not impelemented');
};

var SMA = module.exports.SMA = function(n) {
  if (! (this instanceof SMA)) { // enforcing new
    return new SMA(n);
  }
  Technical.call(this);
  this.q = new Queue(n);
};
SMA.prototype = Object.create(Technical.prototype);
SMA.prototype.analize = function(stockPrice) {
  var q = this.q;
  if (q.enq(stockPrice)) {
    return q.ave();
  }
};

var LSS = module.exports.LSS = function(n) {
  if (! (this instanceof LSS)) { // enforcing new
    return new LSS(n);
  }
  Technical.call(this);
  this.q = new Queue(n, function(i) {
    return this[i];
  });
};
LSS.prototype = Object.create(Technical.prototype);
LSS.prototype.analize = function(stockPrice) {
  var q = this.q;
  if (q.enq(stockPrice)) {
    return q.llss();
  }
};

var ALSS = module.exports.ALSS = function(n, t) {
  if (! (this instanceof ALSS)) { // enforcing new
    return new ALSS(n, t);
  }
  Technical.call(this);
  this.t = t;
  this.q = new Queue(n, function(i) {
    //var cit = this[i - t];
    //return (this[i] - cit) - (cit - this[i - 2 * t]);
    return this[i] - 2 * this[i - t] + this[i - 2 * t];
  },
  2 * t);
};
ALSS.prototype = Object.create(Technical.prototype);
ALSS.prototype.analize = function(stockPrice) {
  var q = this.q;
  if (q.enq(stockPrice)) {
    return q.llss();
  }
};

var EMA = module.exports.EMA = function(n) {
  if (! (this instanceof EMA)) { // enforcing new
    return new EMA(n);
  }
  Technical.call(this);
  this.e = new Ema(n);
};
EMA.prototype = Object.create(Technical.prototype);
EMA.prototype.analize = function(stockPrice) {
  var e = this.e;
  if (e.add(stockPrice)) {
    return e.ema;
  }
};

var DEMA = module.exports.DEMA = function(n, t) {
  if (! (this instanceof DEMA)) { // enforcing new
    return new DEMA(n, t);
  }
  Technical.call(this);
  this.e = new Ema(n);
  this.e2 = new Ema(t);
};
DEMA.prototype = Object.create(Technical.prototype);
DEMA.prototype.analize = function(stockPrice) {
  // http://www.metatrader5.com/en/terminal/help/analytics/indicators/trend_indicators/dema
  var e = this.e;
  var e2 = this.e2;
  e.add(stockPrice);
  if (e2.add(stockPrice - e.ema)) {
    return e.ema + e2.ema;
  }
};

var EMAS = module.exports.EMAS = function(n, contDays, ratio, t) {
  this.contDays = contDays;
  this.ratio = ratio;
  this.t = t;
  this.q = new Queue(2 * t + 1);
  this.e = new Ema(n);
};
EMAS.prototype.reset = reset;
EMAS.prototype.analize = function(stockPrice) {
  var t = this.t;
  var q = this.q;
  var e = this.e;
  if (e.add(stockPrice)) {
    stockPrice = e.ema;
    if (q.enq(stockPrice)) {
      var oldestId = q.oldestId;
      var qt = q[t + oldestId];
      var slope = (q[2 * t + oldestId] - qt) - (qt - q[oldestId]);

      if (this.ratio < slope) {
        return true;
      }
    }
  }
  return false;
};

var BOIL = module.exports.BOIL = function(n, contDays, ratio) {
  this.contDays = contDays;
  this.ratio = ratio;
  this.q = new Queue(n);
};
BOIL.prototype.reset = reset;
BOIL.prototype.analize = function(stockPrice) {
  var q = this.q;
  if (q.enq(stockPrice)) {
    var oldestId = q.oldestId;
    var n = q.length;
    var ave = q.ave();
    var plusSigma = 0;

    for (var i = oldestId, l = oldestId + n; i < l; i++) {
      var diff = q[i] - ave;
      plusSigma += diff * diff;
    }
    plusSigma = Math.sqrt(plusSigma / n) * 2 + ave;

    if (this.ratio * plusSigma < stockPrice) {
      return true;
    }
  }
  return false;
};

var CCIMA = module.exports.CCIMA = function(nCCI, nEMA) {
  this.nCCI = nCCI;
  this.q = new Queue(this.nCCI);
  this.e = new Ema(nEMA);
};
CCIMA.prototype.reset = reset;
CCIMA.prototype.buyOrSell = function(stockPrice) {
  var ret = 1;
  var nCCI = this.nCCI;
  var q = this.q;
  var e = this.e;
  if (q.enq(stockPrice)) {
    var tp = stockPrice; // has to be (high, low, close)/3
    var ma = q.ave();
    var md = 0;
    for (var i = 0; i < nCCI; i++) {
      md = (ma - q[i + q.oldestId]);
    }
    md /= nCCI;

    var cci = (tp - ma) / (0.015 * md);

    if (e.add(stockPrice)) {
      if (cci < e.ema) {
        ret = - 1;
      }
    }
  }

  return ret;
};

var MACD = module.exports.MACD = function(nFast, nSlow, nSignal) {
  this.eFast = new Ema(nFast);
  this.eSlow = new Ema(nSlowA);
  this.eSignal = new Ema(nSignal);
};
MACD.prototype.buyOrSell = function(stockPrice) {
  var ret = 1;

  var eFast = this.eFast;
  var eSlow = this.eSlow;
  var eSignal = this.eSignal;
  var macd = 0;

  if (eFast.add(stockPrice) && eSlow.add(stockPrice)) {
    macd = eFast.ema - eSlow.ema;
  }

  if (eSignal.add(stockPrice) && macd) {
    if (macd < eSignal.ema) {
      ret = - 1;
    }
  }
  return ret;
};
MACD.prototype.reset = reset;
