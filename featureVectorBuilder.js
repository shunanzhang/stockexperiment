var Technicals = require('./technicals');
var LSS = Technicals.LSS;
var ALSS = Technicals.ALSS;

var FeatureVectorBuilder = module.exports = function() {
  if (! (this instanceof FeatureVectorBuilder)) { // enforcing new
    return new FeatureVectorBuilder();
  }
  this.lss200  = new LSS(101);
  this.alss200 = new ALSS(33, 20);
};

FeatureVectorBuilder.prototype.build = function(close, high, low, open, volume) {
  var LSS200 = this.lss200.analize(close);
  var ALSS200 = this.alss200.analize(close);
  var featureVector = {
    sma200a  : 1,
    sma200b  : 1.01,
    sma200c  : 0.5,
    sma200d  : 0.5,
    lss200a  : LSS200,
    alss200a : ALSS200,
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
