var Technicals = require('./technicals');
var LSS = Technicals.LSS;
var BOL = Technicals.BOL;

var FeatureVectorBuilder = module.exports = function() {
  if (! (this instanceof FeatureVectorBuilder)) { // enforcing new
    return new FeatureVectorBuilder();
  }
  this.boil = new BOL(20);
  this.upper  = new LSS(50);
  this.lower  = new LSS(50);
};

FeatureVectorBuilder.prototype.build = function(close, high, low, open, volume) {
  var band = this.boil.analize(close);
  var featureVector = {
    band: band,
    close: close,
    high: high,
    low: low,
    uLss: band ? this.upper.analize(band.upper) : undefined,
    //lLss: band ? this.lower.analize(band.lower) : undefined,
    lLss: band ? this.upper.analize(band.lower) : undefined,
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
