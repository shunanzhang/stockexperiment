var Technicals = require('./technicals');
//var SMA = Technicals.SMA;
//var GAINS = Technicals.GAINS;
var LSS = Technicals.LSS;
var ALSS = Technicals.ALSS;
//var EMA = Technicals.EMA;
//var DEMA = Technicals.DEMA;
//var EMAS= Technicals.EMAS;
//var PVALUE = Technicals.PVALUE;
//var MACD = Technicals.MACD;
//var STOCHASTIC = Technicals.STOCHASTIC;
//var RSI = Technicals.RSI;
//var KF = require('./kf');

var FeatureVectorBuilder = module.exports = function() {
  if (! (this instanceof FeatureVectorBuilder)) { // enforcing new
    return new FeatureVectorBuilder();
  }
  //this.sma200       = new SMA(200);
  this.lss200       = new LSS(101);
  this.alss200      = new ALSS(33, 20);
  //this.ema200       = new EMA(200);
  //this.dema200      = new DEMA(200);
  //this.emas200      = new EMAS(200, 4);
  //this.pvalue200    = new PVALUE(200);
  //this.MACD12       = new MACD(12, 26, 9);
  //this.MACD5        = new MACD(5, 35, 5);
  //this.stochastic14 = new STOCHASTIC(14, 3, 3);
  //this.stochastic5  = new STOCHASTIC(5, 3, 3);
  //this.RSI          = new RSI(14);
  //this.volume10     = new SMA(10);
  //this.gains        = new GAINS(5);
  //this.kf           = new KF();
};

FeatureVectorBuilder.prototype.build = function(close, high, low, open, volume) {
  //var SMA200 = close / this.sma200.analize(close);
  //var PVALUE200 = this.pvalue200.analize(close);
  var LSS200 = this.lss200.analize(close);
  var ALSS200 = this.alss200.analize(close);
  //var MACD12 = this.MACD12.analize(close);
  //var STOCHASTIC14 = this.stochastic14.analize(close, high, low) / 50 - 1;
  //var VOLUME10 = volume / this.volume10.analize(volume);
  var featureVector = {
    sma200a     : 1,//SMA200,
    sma200b     : 1.01,//SMA200,
    sma200c     : 0.5,//SMA200,
    sma200d     : 0.5,//SMA200,
    lss200a     : LSS200,
    alss200a     : ALSS200,
    //ema200      : close - this.ema200.analize(close),
    //dema200     : close - this.dema200.analize(close),
    //emas200     : this.emas200.analize(close),
    //PVALUE200a  : PVALUE200,
    //MACD12      : MACD12,
    //MACD5       : this.MACD5.analize(close),
    //stochastic14a: STOCHASTIC14,
    //STOCHASTIC5 : this.stochastic5.analize(close, high, low) / 50 -1,
    //RSI         : this.RSI.analize(close) / 50 - 1,
    //volume10a    : VOLUME10,
    //kf : close / this.kf.update(1, close)[1],
  }; // key: feature, val:scalar
  var i = 0;
  var isNaN = isNaN;
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

FeatureVectorBuilder.prototype.reset = function() {
  for (var prop in this) {
    if (this.hasOwnProperty(prop) && this[prop].reset) {
      this[prop].reset();
    }
  }
};
