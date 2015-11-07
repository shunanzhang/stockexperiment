// TODO use ES6 class
var Queue = require('./queue');
var Ema = require('./ema');
var pValues = require('./normalDistributionTable').pValues;

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

var GAINS = module.exports.GAINS = function(n) {
  if (! (this instanceof GAINS)) { // enforcing new
    return new GAINS(n);
  }
  Technical.call(this);
  this.q = new Queue(n, function(i) {
    return this[i] - this[i - 1];
  });
};
GAINS.prototype = Object.create(Technical.prototype);
GAINS.prototype.analize = function(stockPrice) {
  var q = this.q;
  if (q.enq(stockPrice)) {
    var oldestId = q.oldestId;
    var n = q.length;
    var results = [];
    for (var i = oldestId, l = oldestId + n; i < l; i++) {
      results.push(q.yq[i]);
    }
    return results;
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

var DEMA = module.exports.DEMA = function(n) {
  if (! (this instanceof DEMA)) { // enforcing new
    return new DEMA(n);
  }
  Technical.call(this);
  this.e = new Ema(n);
  this.e2 = new Ema(n);
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

var EMAS = module.exports.EMAS = function(n, t) {
  if (! (this instanceof EMAS)) { // enforcing new
    return new EMAS(n, t);
  }
  Technical.call(this);
  this.t = t;
  this.q = new Queue(2 * t + 1);
  this.e = new Ema(n);
};
EMAS.prototype = Object.create(Technical.prototype);
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

      return slope;
    }
  }
};

var PVALUE = module.exports.PVALUE = function(n) {
  if (! (this instanceof PVALUE)) { // enforcing new
    return new PVALUE(n);
  }
  Technical.call(this);
  this.q = new Queue(n);
};
PVALUE.prototype = Object.create(Technical.prototype);
PVALUE.prototype.analize = function(stockPrice) {
  var q = this.q;
  if (q.enq(stockPrice)) {
    var oldestId = q.oldestId;
    var n = q.length;
    var ave = q.ave();
    var sigma = 0;

    for (var i = oldestId, l = oldestId + n; i < l; i++) {
      var diff = q[i] - ave;
      sigma += diff * diff;
    }
    sigma = Math.sqrt(sigma / n);
    var zScore100 = (100 * (stockPrice - ave) / sigma) | 0;
    var sign = -1;
    if (zScore100 < 0) {
      zScore100 = -zScore100;
      sign = 1;
    }
    // The lower stock price, the closer to +1 is returned.
    // The higher stock price, the closer to -1 is returned.
    return (zScore100 < pValues.length ? pValues[zScore100] : 1.0) * sign; // -1.0 ~ -0.5 or 0.5 ~ 1.0
  }
};

var BOIL = module.exports.BOIL = function(n) {
  if (! (this instanceof BOIL)) { // enforcing new
    return new BOIL(n);
  }
  Technical.call(this);
  this.q = new Queue(n);
};
BOIL.prototype = Object.create(Technical.prototype);
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
    plusSigma = Math.sqrt(plusSigma / n) * 2 + ave; // 2sigma
    return plusSigma;
  }
};
BOIL.prototype.provision = function(stockPrice) {
  var q = this.q;
  var n = q.length;
  var oldestId = q.oldestId;
  var newestId = oldestId + n;
  if (newestId >= q.limit) {
    var ave = (q.sum + stockPrice - q[oldestId]) / n; // TODO change to EMA
    var sigma = 0;
    var diff = 0;

    for (var i = oldestId + 1, l = oldestId + n; i < l; i++) {
      diff = q[i] - ave;
      sigma += diff * diff;
    }
    diff = stockPrice - ave;
    sigma += diff * diff;
    sigma = Math.sqrt(sigma / n) * 2; // 2sigma
    return (stockPrice > sigma + ave) ? 1 : (stockPrice < ave - sigma) ? -1 : 0;
  }
  return 0;
};

//var CCIMA = module.exports.CCIMA = function(nCCI, nEMA) {
//  this.nCCI = nCCI;
//  this.q = new Queue(this.nCCI);
//  this.e = new Ema(nEMA);
//};
//CCIMA.prototype.reset = reset;
//CCIMA.prototype.buyOrSell = function(stockPrice) {
//  var ret = 1;
//  var nCCI = this.nCCI;
//  var q = this.q;
//  var e = this.e;
//  if (q.enq(stockPrice)) {
//    var tp = stockPrice; // has to be (high, low, close)/3
//    var ma = q.ave();
//    var md = 0;
//    for (var i = 0; i < nCCI; i++) {
//      md = (ma - q[i + q.oldestId]);
//    }
//    md /= nCCI;
//
//    var cci = (tp - ma) / (0.015 * md);
//
//    if (e.add(stockPrice)) {
//      if (cci < e.ema) {
//        ret = - 1;
//      }
//    }
//  }
//
//  return ret;
//};

var MACD = module.exports.MACD = function(nFast, nSlow, nSignal) {
  if (! (this instanceof MACD)) { // enforcing new
    return new MACD(nFast, nSlow, nSignal);
  }
  Technical.call(this);
  this.eFast = new Ema(nFast);
  this.eSlow = new Ema(nSlow);
  this.eSignal = new Ema(nSignal);
};
MACD.prototype = Object.create(Technical.prototype);
MACD.prototype.analize = function(stockPrice) {
  var eFast = this.eFast;
  var eSlow = this.eSlow;
  var eSignal = this.eSignal;
  var macd = 0;

  if (eFast.add(stockPrice) && eSlow.add(stockPrice)) {
    macd = eFast.ema - eSlow.ema;
  }

  if (eSignal.add(stockPrice) && macd) {
    return macd - eSignal.ema;
  }
};

var STOCHASTIC = module.exports.STOCHASTIC = function(n, m, o) {
  if (! (this instanceof STOCHASTIC)) { // enforcing new
    return new STOCHASTIC(n);
  }
  Technical.call(this);
  this.qh = new Queue(n);
  this.ql = new Queue(n);
  this.qk = new Queue(m);
  this.qd = new Queue(o);
};
STOCHASTIC.prototype = Object.create(Technical.prototype);
STOCHASTIC.prototype.analize = function(stockPrice, high, low) {
  var qh = this.qh;
  var ql = this.ql;
  var qk = this.qk;
  var qd = this.qd;
  if (qh.enq(high) && ql.enq(low)) {
    var h = qh.high;
    var l = ql.low;
    var k = 100 * (stockPrice - l) / (h - l);
    if (qk.enq(k)) {
      if (qd.enq(qk.ave())) {
        return qd.ave(); // %D
      }
    }
  }
};

var RSI = module.exports.RSI = function(n) {
  if (! (this instanceof RSI)) { // enforcing new
    return new RSI(n);
  }
  Technical.call(this);
  this.n = n;
  this.aveGain = 0.0;
  this.aveLoss = 0.0;
  this.prevPrice = 0;
};
RSI.prototype = Object.create(Technical.prototype);
RSI.prototype.analize = function(stockPrice) {
  var n = this.n;
  var prevPrice = this.prevPrice;
  if (prevPrice) {
    var aveGain = this.aveGain = this.aveGain * (n - 1) + (stockPrice > prevPrice? stockPrice - prevPrice : 0);
    var aveLoss = this.aveLoss = this.aveLoss * (n - 1) + (stockPrice < prevPrice? prevPrice - stockPrice : 0);
    this.prevPrice = stockPrice;
    return 100 - 100 / (1 + aveGain / aveLoss);
  }
  this.prevPrice = stockPrice;
};


// Day of the week
// Monday -0.10%
// Thuesday -0.13%
// Wednesday +0.12%
// Thursday +0.20%
// Friday -0.17%
