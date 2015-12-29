var Technicals = require('./technicals');
var BOL = Technicals.BOL;

var FeatureVectorBuilder = module.exports = function() {
  if (! (this instanceof FeatureVectorBuilder)) { // enforcing new
    return new FeatureVectorBuilder();
  }
  this.bol = new BOL(20);
};

FeatureVectorBuilder.prototype.build = function(close, high, low, open, volume) {
  var band = this.bol.analize(close);
  var featureVector = {
    band: band,
    open: open,
    close: close,
    high: high,
    low: low,
  }; // key: feature, val:scalar
  return featureVector;
};

FeatureVectorBuilder.prototype.reset = function() {
  for (var prop in this) {
    if (this.hasOwnProperty(prop) && this[prop].reset) {
      this[prop].reset();
    }
  }
};
