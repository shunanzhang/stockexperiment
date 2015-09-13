var Subarray = function(start, end, sum) {
  if (! (this instanceof Subarray)) { // enforcing new
    return new Subarray(array);
  }
  this.start = start; // inclusive
  this.end = end; // inclusive
  this.sum = sum;
};

var KMaximalSubarrays = module.exports = function(array) {
  if (! (this instanceof KMaximalSubarrays)) { // enforcing new
    return new KMaximalSubarrays(array);
  }
  this.array = array;
};

KMaximalSubarrays.prototype.getRanges = function(k) {
  // This is O(n * k)
  // TODO make it to O(O + k) https://users-cs.au.dk/gerth/papers/mfcs07sum.pdf
  var sum = 0;
  var array = this.array;
  var results = [];
  var start = 0;
  for (var i = 0, l = array.length; i < l; i++) {
    if (sum + array[i] > 0) {
      sum += array[i];
      var newSubarray = new Subarray(start, i, sum);
      for (var j = 0; j < k; j++) {
        var result = results[j];
        if (result === undefined) {
          results[j] = newSubarray;
          break;
        } else if (result.start === newSubarray.start) {
          if (result.sum < newSubarray.sum) {
            results.splice(j, 1, newSubarray); // replace the current subarray
          }
          break;
        } else if (result.sum < newSubarray.sum) {
          results.splice(j, 0, newSubarray); // insert the new subarray
          for (var m = j + 1, ml = results.length; m < ml; m++) { // find subsequent element that has the same start
            if (results[m].start === newSubarray.start) {
              results.splice(m, 1); // remove 1 element at m
              break;
            }
          }
          results.splice(k, 1); // remove 1 element if results.length is longer than k
          break;
        }
      }
    } else {
      start = i + 1;
      sum = 0;
    }
  }
  return results;
};
