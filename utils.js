var round = Math.round;

module.exports.toCent = function(flt) {
  //http://stackoverflow.com/questions/4228356/integer-division-in-javascript
  return round(flt * 100) | 0;
};

module.exports.roundCent = function(flt) {
  //http://stackoverflow.com/questions/9453421/how-to-round-float-numbers-in-javascript
  return round(flt * 100) / 100;
};

module.exports.MAX_INT = 0x7FFFFFFF; // max 31 bit
module.exports.MIN_INT = -0x7FFFFFFE; // negative max 31 bit

var max2 = module.exports.max2 = function(a, b) {
  return a > b ? a : b;
};

var min2 = module.exports.min2 = function(a, b) {
  return a < b ? a : b;
};

var max6 = module.exports.max6 = function(a, b, c, d, e, f) {
  var abc = a > b ? a > c ? a : c : b > c ? b : c;
  var def = d > e ? d > f ? d : f : e > f ? e : f;
  return abc > def ? abc : def;
};

var min6 = module.exports.min6 = function(a, b, c, d, e, f) {
  var abc = a < b ? a < c ? a : c : b < c ? b : c;
  var def = d < e ? d < f ? d : f : e < f ? e : f;
  return abc < def ? abc : def;
};

if (!module.parent) {
  var max = Math.max;
  var min = Math.min;
  var i, e=1e5;
  console.time('max2');
  i = e;
  while (i--) {
    max2(i, 2.2);
  }
  console.timeEnd('max2');
  console.time('max');
  i = e;
  while (i--) {
    max(i, 2.2);
  }
  console.timeEnd('max');
  console.time('min2');
  i = e;
  while (i--) {
    min2(i, 2.2);
  }
  console.timeEnd('min2');
  console.time('min');
  i = e;
  while (i--) {
    min(i, 2.2);
  }
  console.timeEnd('min');
  console.time('max6');
  i = e;
  while (i--) {
    max6(i, 2.2, 3.3, 4.4, 5.5, 6.6);
  }
  console.timeEnd('max6');
  console.time('max');
  i = e;
  while (i--) {
    max(i, 2.2, 3.3, 4.4, 5.5, 6.6);
  }
  console.timeEnd('max');
  console.time('min6');
  i = e;
  while (i--) {
    min6(i, 2.2, 3.3, 4.4, 5.5, 6.6);
  }
  console.timeEnd('min6');
  console.time('min');
  i = e;
  while (i--) {
    min(i, 2.2, 3.3, 4.4, 5.5, 6.6);
  }
  console.timeEnd('min');
  console.log(max2(2.2, 1.1));
  console.log(min2(2.2, 1.1));
  console.log(max6(2.2, 1.1, 4.4, 6.6, 5.5, 3,3));
  console.log(min6(2.2, 1.1, 4.4, 6.6, 5.5, 3,3));
}
