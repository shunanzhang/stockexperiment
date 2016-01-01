var round = Math.round;

module.exports.toCent = function(flt) {
  //http://stackoverflow.com/questions/4228356/integer-division-in-javascript
  return round(flt * 100) | 0;
};

module.exports.roundCent = function(flt) {
  //http://stackoverflow.com/questions/9453421/how-to-round-float-numbers-in-javascript
  return round(flt * 100) / 100;
};
