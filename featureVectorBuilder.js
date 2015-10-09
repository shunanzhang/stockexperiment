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
  //this.sma10        = new SMA(10);
  //this.sma20        = new SMA(20);
  //this.sma30        = new SMA(30);
  //this.sma50        = new SMA(50);
  //this.sma60        = new SMA(60);
  //this.sma100       = new SMA(100);
  this.sma200       = new SMA(200);
  this.sma200h      = new SMA(200);
  this.sma200l      = new SMA(200);
  //this.lss10        = new LSS(10);
  //this.lss20        = new LSS(20);
  //this.lss50        = new LSS(50);
  //this.lss100       = new LSS(100);
  this.lss200       = new LSS(230);
  //this.alss10       = new ALSS(10, 4);
  //this.alss20       = new ALSS(20, 4);
  //this.alss50       = new ALSS(50, 4);
  //this.alss100      = new ALSS(100, 4);
  //this.alss200      = new ALSS(200, 4);
  //this.ema10        = new EMA(10);
  //this.ema20        = new EMA(20);
  //this.ema50        = new EMA(50);
  //this.ema100       = new EMA(100);
  //this.ema200       = new EMA(200);
  //this.dema10       = new DEMA(10);
  //this.dema20       = new DEMA(20);
  //this.dema50       = new DEMA(50);
  //this.dema100      = new DEMA(100);
  //this.dema200      = new DEMA(200);
  //this.emas10       = new EMAS(10, 4);
  //this.emas20       = new EMAS(20, 4);
  //this.emas50       = new EMAS(50, 4);
  //this.emas100      = new EMAS(100, 4);
  //this.emas200      = new EMAS(200, 4);
  //this.PVALUE10     = new PVALUE(10);
  //this.PVALUE20     = new PVALUE(20);
  //this.PVALUE50     = new PVALUE(50);
  //this.PVALUE100    = new PVALUE(100);
  //this.pvalue200    = new PVALUE(200);
  //this.BOIL         = new BOIL(20);
  //this.MACD12       = new MACD(12, 26, 9);
  //this.MACD5        = new MACD(5, 35, 5);
  //this.stochastic14 = new STOCHASTIC(14, 3, 3);
  //this.stochastic5  = new STOCHASTIC(5, 3, 3);
  //this.RSI          = new RSI(14);
  //this.volume10     = new SMA(10);
  //this.gains        = new GAINS(5);
  //this.count = 0;
};

FeatureVectorBuilder.prototype.build = function(close, high, low, open, volume) {
  var SMA200 = close / this.sma200.analize(close);
  var SMA200H = close / this.sma200h.analize(high);
  var SMA200L = close / this.sma200l.analize(low);
  //var PVALUE200 = this.pvalue200.analize(close);
  var LSS200 = this.lss200.analize(close);
  //var ALSS200 = this.alss200.analize(close);
  //var MACD12 = this.MACD12.analize(close);
  //var STOCHASTIC14 = this.stochastic14.analize(close, high, low) / 50 - 1;
  var VOLUME10 = volume / this.volume10.analize(volume);
  var featureVector = {
    //sma10       : close - this.sma10.analize(close),
    //sma20       : close - this.sma20.analize(close),
    //sma30       : close - this.sma30.analize(close),
    //sma50       : close - this.sma50.analize(close),
    //sma60       : close - this.sma60.analize(close),
    //sma100      : close - this.sma100.analize(close),
    sma200a     : SMA200,
    sma200b     : SMA200,
    sma200c     : SMA200,
    sma200d     : SMA200,
    sma200e     : SMA200,
    sma200f     : SMA200,
    sma200g     : SMA200,
    sma200h     : SMA200,
    sma200i     : SMA200,
    sma200j     : SMA200,
    sma200k     : SMA200,
    sma200l     : SMA200,
    sma200m     : SMA200,
    sma200n     : SMA200,
    sma200o     : SMA200,
    sma200p     : SMA200,
    sma200q     : SMA200,
    sma200r     : SMA200,
    sma200s     : SMA200,
    sma200t     : SMA200,
    sma200ha    : SMA200H,
    sma200hb    : SMA200H,
    sma200hc    : SMA200H,
    sma200hd    : SMA200H,
    sma200he    : SMA200H,
    sma200hf    : SMA200H,
    sma200hg    : SMA200H,
    sma200hh    : SMA200H,
    sma200hi    : SMA200H,
    sma200hj    : SMA200H,
    sma200hk    : SMA200H,
    sma200hl    : SMA200H,
    sma200hm    : SMA200H,
    sma200hn    : SMA200H,
    sma200ho    : SMA200H,
    sma200hp    : SMA200H,
    sma200hq    : SMA200H,
    sma200hr    : SMA200H,
    //sma200hs    : SMA200H,
    //sma200ht    : SMA200H,
    sma200la    : SMA200L,
    sma200lb    : SMA200L,
    sma200lc    : SMA200L,
    sma200ld    : SMA200L,
    sma200le    : SMA200L,
    sma200lf    : SMA200L,
    sma200lg    : SMA200L,
    sma200lh    : SMA200L,
    sma200li    : SMA200L,
    sma200lj    : SMA200L,
    sma200lk    : SMA200L,
    sma200ll    : SMA200L,
    sma200lm    : SMA200L,
    sma200ln    : SMA200L,
    sma200lo    : SMA200L,
    sma200lp    : SMA200L,
    sma200lq    : SMA200L,
    sma200lr    : SMA200L,
    //sma200ls    : SMA200L,
    //sma200lt    : SMA200L,
    //lss10       : this.lss10.analize(close),
    //lss20       : this.lss20.analize(close),
    //lss50       : this.lss50.analize(close),
    //lss100      : this.lss100.analize(close),
    lss200a     : LSS200,
    lss200b     : LSS200,
    lss200c     : LSS200,
    lss200d     : LSS200,
    lss200e     : LSS200,
    lss200f     : LSS200,
    lss200g     : LSS200,
    lss200h     : LSS200,
    lss200i     : LSS200,
    lss200j     : LSS200,
    lss200k     : LSS200,
    lss200l     : LSS200,
    lss200m     : LSS200,
    lss200n     : LSS200,
    lss200o     : LSS200,
    lss200p     : LSS200,
    lss200q     : LSS200,
    lss200r     : LSS200,
    lss200s     : LSS200,
    lss200t     : LSS200,
    //alss10      : this.alss10.analize(close),
    //alss20      : this.alss20.analize(close),
    //alss50      : this.alss50.analize(close),
    //alss100     : this.alss100.analize(close),
    //alss200a     : ALSS200,
    //alss200b     : ALSS200,
    //alss200c     : ALSS200,
    //alss200d     : ALSS200,
    //alss200e     : ALSS200,
    //alss200f     : ALSS200,
    //alss200g     : ALSS200,
    //alss200h     : ALSS200,
    //alss200i     : ALSS200,
    //alss200j     : ALSS200,
    //alss200k     : ALSS200,
    //alss200l     : ALSS200,
    //alss200m     : ALSS200,
    //alss200n     : ALSS200,
    //alss200o     : ALSS200,
    //alss200p     : ALSS200,
    //alss200q     : ALSS200,
    //alss200r     : ALSS200,
    //alss200s     : ALSS200,
    //alss200t     : ALSS200,
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
    //PVALUE200a  : PVALUE200,
    //PVALUE200b  : PVALUE200,
    //PVALUE200c  : PVALUE200,
    //PVALUE200d  : PVALUE200,
    //PVALUE200e  : PVALUE200,
    //PVALUE200f  : PVALUE200,
    //PVALUE200g  : PVALUE200,
    //PVALUE200h  : PVALUE200,
    //PVALUE200i  : PVALUE200,
    //PVALUE200j  : PVALUE200,
    //PVALUE200k  : PVALUE200,
    //PVALUE200l  : PVALUE200,
    //PVALUE200m  : PVALUE200,
    //PVALUE200n  : PVALUE200,
    //PVALUE200o  : PVALUE200,
    //PVALUE200p  : PVALUE200,
    //BOIL        : this.BOIL.analize(close),
    //MACD12      : MACD12,
    //MACD5       : this.MACD5.analize(close),
    //stochastic14a: STOCHASTIC14,
    //stochastic14b: STOCHASTIC14,
    //stochastic14c: STOCHASTIC14,
    //stochastic14d: STOCHASTIC14,
    //stochastic14e: STOCHASTIC14,
    //stochastic14f: STOCHASTIC14,
    //stochastic14g: STOCHASTIC14,
    //stochastic14h: STOCHASTIC14,
    //stochastic14i: STOCHASTIC14,
    //stochastic14j: STOCHASTIC14,
    //stochastic14k: STOCHASTIC14,
    //stochastic14l: STOCHASTIC14,
    //stochastic14m: STOCHASTIC14,
    //stochastic14n: STOCHASTIC14,
    //stochastic14o: STOCHASTIC14,
    //stochastic14p: STOCHASTIC14,
    //stochastic14q: STOCHASTIC14,
    //stochastic14r: STOCHASTIC14,
    //stochastic14s: STOCHASTIC14,
    //stochastic14t: STOCHASTIC14,
    //STOCHASTIC5 : this.stochastic5.analize(close, high, low) / 50 -1,
    //RSI         : this.RSI.analize(close) / 50 - 1,
    //volume10a    : VOLUME10,
    //volume10b    : VOLUME10,
    //volume10c    : VOLUME10,
    //volume10d    : VOLUME10,
    //volume10e    : VOLUME10,
    //volume10f    : VOLUME10,
    //volume10g    : VOLUME10,
    //volume10h    : VOLUME10,
    //volume10i    : VOLUME10,
    //volume10j    : VOLUME10,
    //volume10k    : VOLUME10,
    //volume10l    : VOLUME10,
    //volume10m    : VOLUME10,
    //volume10n    : VOLUME10,
    //volume10o    : VOLUME10,
    //volume10p    : VOLUME10,
    //volume10q    : VOLUME10,
    //volume10r    : VOLUME10,
    //volume10s    : VOLUME10,
    //volume10t    : VOLUME10,
  }; // key: feature, val:scalar
  //if (SMA200 > 0) {
  //  if (this.count >= 0) {
  //    this.count += 1;
  //  } else {
  //    this.count = 1;
  //  }
  //} else if (SMA200 < 0) {
  //  if (this.count <= 0) {
  //    this.count -= 1;
  //  } else {
  //    this.count = -1;
  //  }
  //}
  //featureVector['counta'] = this.count;
  //featureVector['countb'] = this.count;
  //featureVector['countc'] = this.count;
  //featureVector['countd'] = this.count;
  //featureVector['counte'] = this.count;
  //featureVector['countf'] = this.count;
  //featureVector['countg'] = this.count;
  //featureVector['counth'] = this.count;
  //featureVector['counti'] = this.count;
  //featureVector['countj'] = this.count;
  //featureVector['countk'] = this.count;
  //featureVector['countl'] = this.count;
  //featureVector['countm'] = this.count;
  //featureVector['countn'] = this.count;
  //featureVector['counto'] = this.count;
  //featureVector['countp'] = this.count;
  //featureVector['countq'] = this.count;
  //featureVector['countr'] = this.count;
  //featureVector['counts'] = this.count;
  //featureVector['countt'] = this.count;
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
