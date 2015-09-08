var Queue = require('./queue');
var Ema = require('./ema');

var reset = function() {
  if (this.daysOver) {
    this.daysOver = 0;
  }
  if (this.q) {
    this.q.reset();
  }
  if (this.e) {
    this.e.reset();
  }
  if (this.e2) {
    this.e2.reset();
  }
};

var SMA = module.exports.SMA = function(n, contDays, ratio) {
  this.contDays = contDays;
  this.ratio = ratio;
  this.q = new Queue(n);
};
SMA.prototype.reset = reset;
SMA.prototype.analize = function(stockPrice) {
  var q = this.q;
  if (q.enq(stockPrice)) {
    if (this.ratio * q.ave() < stockPrice) {
      return true;
    }
  }
  return false;
};

var NSMA = module.exports.NSMA = function(n, contDays, ratio) {
  this.contDays = contDays;
  this.ratio = ratio;
  this.q = new Queue(n);
};
NSMA.prototype.reset = reset;
NSMA.prototype.analize = function(stockPrice) {
  var q = this.q;
  if (q.enq(stockPrice)) {
    if (this.ratio * q.ave() < stockPrice) {
      return false;
    }
  }
  return true;
};

var LSS = module.exports.LSS = function(n, contDays, ratio) {
  this.contDays = contDays;
  this.ratio = ratio;
  this.q = new Queue(n, function(i) {
    return this[i];
  });
};
LSS.prototype.reset = reset;
LSS.prototype.analize = function(stockPrice) {
  var q = this.q;
  if (q.enq(stockPrice)) {
    if (q.llss() > this.ratio) {
      return true;
    }
  }
  return false;
};

var ALSS = module.exports.ALSS = function(n, contDays, ratio, t) {
  this.contDays = contDays;
  this.ratio = ratio;
  this.t = t;
  this.q = new Queue(n, function(i) {
    //var cit = this[i - t];
    //return (this[i] - cit) - (cit - this[i - 2 * t]);
    return this[i] - 2 * this[i - t] + this[i - 2 * t];
  },
  2 * t);
};
ALSS.prototype.reset = reset;
ALSS.prototype.analize = function(stockPrice) {
  var t = this.t;
  var q = this.q;
  if (q.enq(stockPrice)) {
    if (q.llss() > this.ratio) {
      return true;
    }
  }
  return false;
};

var EMA = module.exports.EMA = function(n, contDays, ratio) {
  this.contDays = contDays;
  this.ratio = ratio;
  this.e = new Ema(n);
};
EMA.prototype.reset = reset;
EMA.prototype.analize = function(stockPrice) {
  var e = this.e;
  if (e.add(stockPrice)) {
    if (this.ratio * e.ema < stockPrice) {
      return true;
    }
  }
  return false;
};

var NEMA = module.exports.NEMA = function(n, contDays, ratio) {
  this.contDays = contDays;
  this.ratio = ratio;
  this.e = new Ema(n);
};
NEMA.prototype.reset = reset;
NEMA.prototype.analize = function(stockPrice) {
  var e = this.e;
  if (e.add(stockPrice)) {
    if (this.ratio * stockPrice < e.ema) {
      return false;
    }
  }
  return true;
};

var DEMA = module.exports.DEMA = function(n, contDays, ratio, t) {
  this.contDays = contDays;
  this.ratio = ratio;
  this.e = new Ema(n);
  this.e2 = new Ema(t);
};
DEMA.prototype.reset = reset;
DEMA.prototype.analize = function(stockPrice) {
  var e = this.e;
  var e2 = this.e2;
  if (e.add(stockPrice) && e2.add(stockPrice)) {
    if (this.ratio * e.ema < e2.ema) {
      return true;
    }
  }
  return false;
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
MACD.prototype.reset = function() {
  if (this.eFast) {
    this.eFast.reset();
  }
  if (this.eSlow) {
    this.eSlow.reset();
  }
  if (this.eSignal) {
    this.eSignal.reset();
  }
};
