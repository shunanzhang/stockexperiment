module.exports.toCent = function(flt) {
  //http://stackoverflow.com/questions/4228356/integer-division-in-javascript
  return Math.round(flt * 100) | 0;
};
