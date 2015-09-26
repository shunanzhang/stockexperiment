var Technicals = require('./technicals');
var SMA = Technicals.SMA;
var GAINS = Technicals.GAINS;
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

var FeatureVectorBuilder = module.exports = function() {
  if (! (this instanceof FeatureVectorBuilder)) { // enforcing new
    return new FeatureVectorBuilder();
  }
  this.sma10        = new SMA(10);
  this.sma20        = new SMA(20);
  this.sma30        = new SMA(30);
  this.sma50        = new SMA(50);
  this.sma60        = new SMA(60);
  this.sma100       = new SMA(100);
  this.sma200a      = new SMA(200);
  this.sma200b      = new SMA(200);
  this.sma200c      = new SMA(200);
  this.sma200d      = new SMA(200);
  this.sma200e      = new SMA(200);
  this.sma200f      = new SMA(200);
  this.sma200g      = new SMA(200);
  this.sma200h      = new SMA(200);
  this.sma200i      = new SMA(200);
  this.sma200j      = new SMA(200);
  this.sma200k      = new SMA(200);
  this.sma200l      = new SMA(200);
  this.sma200m      = new SMA(200);
  this.sma200n      = new SMA(200);
  this.sma200o      = new SMA(200);
  this.sma200p      = new SMA(200);
  this.lss10        = new LSS(10);
  this.lss20        = new LSS(20);
  this.lss50        = new LSS(50);
  this.lss100       = new LSS(100);
  this.lss200       = new LSS(200);
  this.alss10       = new ALSS(10, 4);
  this.alss20       = new ALSS(20, 4);
  this.alss50       = new ALSS(50, 4);
  this.alss100      = new ALSS(100, 4);
  this.alss200      = new ALSS(200, 4);
  this.ema10        = new EMA(10);
  this.ema20        = new EMA(20);
  this.ema50        = new EMA(50);
  this.ema100       = new EMA(100);
  this.ema200       = new EMA(200);
  this.dema10       = new DEMA(10);
  this.dema20       = new DEMA(20);
  this.dema50       = new DEMA(50);
  this.dema100      = new DEMA(100);
  this.dema200      = new DEMA(200);
  this.emas10       = new EMAS(10, 4);
  this.emas20       = new EMAS(20, 4);
  this.emas50       = new EMAS(50, 4);
  this.emas100      = new EMAS(100, 4);
  this.emas200      = new EMAS(200, 4);
  this.PVALUE10     = new PVALUE(10);
  this.PVALUE20     = new PVALUE(20);
  this.PVALUE50     = new PVALUE(50);
  this.PVALUE100    = new PVALUE(100);
  this.PVALUE200a   = new PVALUE(200);
  this.PVALUE200b   = new PVALUE(200);
  this.PVALUE200c   = new PVALUE(200);
  this.PVALUE200d   = new PVALUE(200);
  this.PVALUE200e   = new PVALUE(200);
  this.PVALUE200f   = new PVALUE(200);
  this.PVALUE200g   = new PVALUE(200);
  this.PVALUE200h   = new PVALUE(200);
  this.PVALUE200i   = new PVALUE(200);
  this.PVALUE200j   = new PVALUE(200);
  this.PVALUE200k   = new PVALUE(200);
  this.PVALUE200l   = new PVALUE(200);
  this.PVALUE200m   = new PVALUE(200);
  this.PVALUE200n   = new PVALUE(200);
  this.PVALUE200o   = new PVALUE(200);
  this.PVALUE200p   = new PVALUE(200);
  this.BOIL         = new BOIL(20);
  this.MACD12       = new MACD(12, 26, 9);
  this.MACD5        = new MACD(5, 35, 5);
  this.STOCHASTIC14 = new STOCHASTIC(14, 3, 3);
  this.STOCHASTIC5  = new STOCHASTIC(5, 3, 3);
  this.RSI          = new RSI(14);
  this.volume10     = new SMA(10);
  this.gains        = new GAINS(5);
};

FeatureVectorBuilder.prototype.build = function(close, high, low, open, volume) {
  var featureVector = {
    //sma10       : close - this.sma10.analize(close),
    //sma20       : close - this.sma20.analize(close),
    //sma30       : close - this.sma30.analize(close),
    //sma50       : close - this.sma50.analize(close),
    //sma51       : close - this.sma50.analize(close),
    //sma60       : close - this.sma60.analize(close),
    //sma100      : close - this.sma100.analize(close),
    sma200a     : close - this.sma200a.analize(close),
    sma200b     : close - this.sma200b.analize(close),
    sma200c     : close - this.sma200c.analize(close),
    sma200d     : close - this.sma200d.analize(close),
    sma200e     : close - this.sma200e.analize(close),
    sma200f     : close - this.sma200f.analize(close),
    sma200g     : close - this.sma200g.analize(close),
    sma200h     : close - this.sma200h.analize(close),
    sma200i     : close - this.sma200i.analize(close),
    sma200j     : close - this.sma200j.analize(close),
    sma200k     : close - this.sma200k.analize(close),
    sma200l     : close - this.sma200l.analize(close),
    sma200m     : close - this.sma200m.analize(close),
    sma200n     : close - this.sma200n.analize(close),
    sma200o     : close - this.sma200o.analize(close),
    sma200p     : close - this.sma200p.analize(close),
    //lss10       : this.lss10.analize(close),
    //lss20       : this.lss20.analize(close),
    //lss50       : this.lss50.analize(close),
    //lss100      : this.lss100.analize(close),
    //lss200      : this.lss200.analize(close),
    //alss10      : this.alss10.analize(close),
    //alss20      : this.alss20.analize(close),
    //alss50      : this.alss50.analize(close),
    //alss100     : this.alss100.analize(close),
    //alss200     : this.alss200.analize(close),
    //ema10       : close - this.ema10.analize(close),
    //ema20       : close - this.ema20.analize(close),
    //ema50       : close - this.ema50.analize(close),
    //ema100      : close - this.ema100.analize(close),
    //ema200      : close - this.ema200.analize(close),
    //dema10      : close - this.dema10.analize(close),
    //dema20      : close - this.dema20.analize(close),
    //dema50      : close - this.dema50.analize(close),
    //dema100     : close - this.dema100.analize(close),
    //dema200     : close - this.dema200.analize(close),
    //emas10      : this.emas10.analize(close),
    //emas20      : this.emas20.analize(close),
    //emas50      : this.emas50.analize(close),
    //emas100     : this.emas100.analize(close),
    //emas200     : this.emas200.analize(close),
    //PVALUE10    : this.PVALUE10.analize(close),
    //PVALUE20    : this.PVALUE20.analize(close),
    //PVALUE50    : this.PVALUE50.analize(close),
    //PVALUE100   : this.PVALUE100.analize(close),
    //PVALUE200a  : this.PVALUE200a.analize(close),
    //PVALUE200b  : this.PVALUE200b.analize(close),
    //PVALUE200c  : this.PVALUE200c.analize(close),
    //PVALUE200d  : this.PVALUE200d.analize(close),
    //PVALUE200e  : this.PVALUE200e.analize(close),
    //PVALUE200f  : this.PVALUE200f.analize(close),
    //PVALUE200g  : this.PVALUE200g.analize(close),
    //PVALUE200h  : this.PVALUE200h.analize(close),
    //PVALUE200i  : this.PVALUE200i.analize(close),
    //PVALUE200j  : this.PVALUE200j.analize(close),
    //PVALUE200k  : this.PVALUE200k.analize(close),
    //PVALUE200l  : this.PVALUE200l.analize(close),
    //PVALUE200m  : this.PVALUE200m.analize(close),
    //PVALUE200n  : this.PVALUE200n.analize(close),
    //PVALUE200o  : this.PVALUE200o.analize(close),
    //PVALUE200p  : this.PVALUE200p.analize(close),
    //BOIL        : this.BOIL.analize(close),
    //MACD12      : this.MACD12.analize(close),
    //MACD5       : this.MACD5.analize(close),
    //STOCHASTIC14: this.STOCHASTIC14.analize(close, high, low) / 50 - 1,
    //STOCHASTIC5 : this.STOCHASTIC5.analize(close, high, low) / 50 -1,
    //RSI         : this.RSI.analize(close) / 50 - 1,
    //volume10    : volume - this.volume10.analize(volume)
  }; // key: feature, val:scalar
  var i = 0;
  var isNaN = isNaN;
  //var gains = this.gains.analize(close);
  //if (gains) {
  //  for (i = 0, l = gains.length; i < l; i++) {
  //    featureVector['gain' + (l - i)] = gains[i];
  //  }
  //}
  if (Number.isNaN) {
    isNaN = Number.isNaN; // ES6 better version of isNaN
  }
  var keys = Object.keys(featureVector || {});
  for (i = keys.length; i--;) {
    key = keys[i];
    var feature = featureVector[key];
    if (feature === undefined || isNaN(feature)) {
      delete featureVector[key];
    }
  }
  return featureVector;
};
