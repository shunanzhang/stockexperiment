var Subarray = function(start, end, sum) {
  if (! (this instanceof Subarray)) { // enforcing new
    return new Subarray(start, end, sum);
  }
  this.start = start; // inclusive
  this.end = end; // inclusive
  this.sum = sum;
};

var KMaximalGains = module.exports = function(prices) {
  if (! (this instanceof KMaximalGains)) { // enforcing new
    return new KMaximalGains(prices);
  }
  this.prices = prices;
};

KMaximalGains.prototype.getRanges = function(k) {
  // This is O(n * k)
  // https://leetcode.com/discuss/25603/a-concise-dp-solution-in-java
  //var sum = 0;
  //var prices = this.prices;
  //var results = [];
  //var start = 0;
  //for (var i = 0, l = prices.length; i < l; i++) {
  //  if (sum + prices[i] > 0) {
  //    sum += prices[i];
  //    var newSubarray = new Subarray(start, i, sum);
  //    for (var j = 0; j < k; j++) {
  //      var result = results[j];
  //      if (result === undefined) {
  //        results[j] = newSubarray;
  //        break;
  //      } else if (result.start === newSubarray.start) {
  //        if (result.sum < newSubarray.sum) {
  //          results.splice(j, 1, newSubarray); // replace the current subarray
  //        }
  //        break;
  //      } else if (result.sum < newSubarray.sum) {
  //        results.splice(j, 0, newSubarray); // insert the new subarray
  //        for (var m = j + 1, ml = results.length; m < ml; m++) { // find subsequent element that has the same start
  //          if (results[m].start === newSubarray.start) {
  //            results.splice(m, 1); // remove 1 element at m
  //            break;
  //          }
  //        }
  //        results.splice(k, 1); // remove 1 element if results.length is longer than k
  //        break;
  //      }
  //    }
  //  } else {
  //    start = i + 1;
  //    sum = 0;
  //  }
  //}
  //return results;



  var results = [];
  var prices = this.prices;
  var len = prices.length;
  if (len <= 1 || k >= (len / 2)) { // k >= (len / 2) means we buy/sell at every price gap, which is not the focus
    return results;
  }

  var i = 0;
  var j = 0;
  var dp = []; // dynamic programming table
  for (i = 2; i--;) {
    dp[i] = [];
    for (j = len; j--;) {
      dp[i][j] = 0;
    }
  }

  for (i = 1; i <= k; i++) {
    var temp = -prices[0];
    var contiguousGainCount = 0;
    for (j = 1; j < len; j++) {
      var currGain = dp[i & 1][j - 1];
      var nextGain = prices[j] + temp;
      if (currGain < nextGain) {
        dp[i & 1][j] = nextGain;
        contiguousGainCount += 1;
        if (i === k) {
          var start = j - contiguousGainCount; // off by one intentionally
          var end = j;
          //var sum = ;
        }
      } else {
        dp[i & 1][j] = currGain;
        contiguousGainCount = 0;
      }
      // dp[i & 1][j] = Math.max(dp[i & 1][j - 1], prices[j] + temp);
      temp =  Math.max(temp, dp[~i & 1][j - 1] - prices[j]);
    }
  }
  return dp[k & 1][len - 1];
};
