var EMA = module.exports = function(n) {
  this.alpha = 2 / (n + 1);
};

EMA.prototype.add = function(p) {
  var ema = this.ema;
  if (ema) {
    var a = this.alpha;
    if (a > 1 || a < 0) {
      this.ema = p;
    } else {
      this.ema += a * (p - ema);
    }
    return true;
  } else {
    this.ema = p;
    return false;
  }
};

EMA.prototype.reset = function() {
  delete this.ema;
};
