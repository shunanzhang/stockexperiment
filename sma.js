var Sma = module.exports = function(length) {
  if (! (this instanceof Sma)) { // enforcing new
    return new Sma(length);
  }
  this.length = length;
  var maxI = 0;
  if (length <= 8) {
    maxI = 7;
  } else if (length <= 16) {
    maxI = 15;
  } else if (length <= 32) {
    maxI = 31;
  } else if (length <= 64) {
    maxI = 63;
  } else if (length <= 128) {
    maxI = 127;
  } else if (length <= 256) {
    maxI = 255;
  } else {
    throw 'unsupported length';
  }
  this.data = new Array(length);
  this.maxI = maxI;
  this.ave = 0.0;
  this.sum = 0.0;
  this.up = false;
  this.down = false;
  this.i = 0;
};

Sma.prototype.push = function(value) {
  var length = this.length;
  var maxI = this.maxI;
  var data = this.data;
  var sum = this.sum;
  var i = this.i;
  this.i = i + 1;
  var i_first = (i - length) & maxI;
  var i_last = i & maxI;
  sum -= data[i_first] || 0.0;
  data[i_last] = value;
  sum += value;
  this.sum = sum;
  var aveOld = this.ave;
  var ave = sum / length;
  this.ave = ave;
  if (i >= maxI) {
    this.up = (ave > aveOld);
    this.down = (ave < aveOld);
  }
};

if (!module.parent) {
  var sma =new Sma(4);
  sma.push(1);
  sma.push(2);
  sma.push(3);
  sma.push(4);
  console.log(2.5, sma.ave, sma.up, sma.down);
  sma.push(4);
  sma.push(3);
  sma.push(1);
  sma.push(2);
  console.log(2.5, sma.ave, sma.up, sma.down);
  sma.push(1);
  sma.push(2);
  sma.push(3);
  sma.push(4);
  console.log(2.5, sma.ave, sma.up, sma.down);
}
