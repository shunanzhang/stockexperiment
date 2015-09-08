var _enq1 = function(item) {
  var oldestId = this.oldestId;
  var newestId = oldestId + this.length;
  this[newestId] = item;
  if (newestId >= this.limit) {
    this.sum += item - this[oldestId];
    this.oldestId += 1;
    return true;
  }
  else {
    this.sum += item;
    this.length += 1;
    return false;
  }
};

var _enq2 = function(item) {
  var oldestId = this.oldestId;
  var newestId = oldestId + this.length;
  this[newestId] = item;
  this.yq[newestId] = this.func_y.call(this, newestId);
  if (newestId >= this.limit) {
    this.oldestId += 1;
    return true;
  }
  else {
    this.length += 1;
    return false;
  }
};

var ave = function() {
  return this.sum / this.length;
};

var llss = function() {
  var start = this.start + this.oldestId;
  var n = this.n;
  var sum_x = this.sum_x;
  var yq = this.yq;

  var sum_y = 0;
  var sum_xy = 0;
  for (var x = n; x--;) {
    var y = yq[start + x];
    sum_y += y;
    sum_xy += x * y;
  }
  return (n * sum_xy - sum_x * sum_y) / this.denominator;
};

var Queue = module.exports = function(limit, func_y, start) {
  start = this.start = start || 0;
  limit = this.limit = limit + start || Number.MAX_VALUE;
  this.oldestId = 0;
  this.length = 0;
  if (func_y) {
    this.func_y = func_y;
    var n = this.n = limit - start;
    var sum_x = this.sum_x = (n - 1) * n / 2; //0 + 1 + 2 +...+ (n-1)
    var sum_xx = (n - 1) * n * (2 * n - 1) / 6; //0^2 + 1^2 + 2^2 +...+ (n-1)^2
    this.denominator = n * sum_xx - sum_x * sum_x;
    this.yq = {};
    this.enq = _enq2;
    this.llss = llss;
  } else {
    this.sum = 0;
    this.enq = _enq1;
    this.ave = ave;
  }
};

Queue.prototype.reset = function() {
  this.sum = 0;
  for (var i = this.oldestId + this.length; i--;) {
    delete this[i];
    //this[i] = undefined; // delete bug workaround
  }
  this.oldestId = 0;
  this.length = 0;
  if (this.yq) {
    this.yq = {};
  }
};
