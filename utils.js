var round = Math.round;

module.exports.toCent = function(flt) {
  //http://stackoverflow.com/questions/4228356/integer-division-in-javascript
  return round(flt * 100) | 0;
};

module.exports.MAX_INT = 0x7FFFFFFF; // max 31 bit
module.exports.MIN_INT = -0x7FFFFFFE; // negative max 31 bit
