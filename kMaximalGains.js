var assert = require('assert');

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
  var end = 0;
  var start = 0;
  var sum = 0;
  var dp = []; // dynamic programming table
  var balances = [];
  var contiguousGainCounts = [];
  for (i = k + 1; i--;) { // 0 <= i <= k
    dp[i] = 0;
    balances[i] = -prices[0];
    contiguousGainCounts[i] = 0;
  }

  for (j = 1; j < len; j++) {
    var price = prices[j];
    var carried = false;
    for (i = k + 1; --i;) { // 0 < i <= k
      if ((carried || i === k) && contiguousGainCounts[i] > 0) {
        end = j - 1;
        start = end - contiguousGainCounts[i]; // off by one intentionally
        sum = prices[end] - prices[start];
        results[i - 1] = new Subarray(start, end, sum);
      }

      var prevBalance = balances[i];
      var nextBalance = dp[i - 1] - price;
      var prevGain = dp[i];
      var nextGain = price + prevBalance;
      if (prevGain < nextGain) { // whether to sell at price
        dp[i] = nextGain;
        contiguousGainCounts[i] += 1;
      } else {
        dp[i] = prevGain;
        contiguousGainCounts[i] = 0;
      }
      if (prevBalance < nextBalance) { // whether to buy at price
        balances[i] = nextBalance;
        carried = true;
      } else {
        balances[i] = prevBalance;
        carried = false;
      }
      if (j + 1 < len && dp[i] >= prices[j + 1] + balances[i]) {
        carried = false;
      }
    }
  }

  if (contiguousGainCounts[k] > 0) {
    end = len - 1;
    start = end - contiguousGainCounts[k]; // off by one intentionally
    sum = prices[end] - prices[start];
    results[k - 1] = new Subarray(start, end, sum);
  }

  //return dp[k];
  return results;
};

var main = function() {
  var test = [1, 5, 1, 2, 1, 3];
  var kMaximalSubarrays = new KMaximalGains(test);
  assert.deepEqual(kMaximalSubarrays.getRanges(2), [{start: 0, end: 1, sum: 4}, {start: 4, end: 5, sum: 2}]);
  test = [1, 2, 3, 2, 3, 4];
  kMaximalSubarrays = new KMaximalGains(test);
  assert.deepEqual(kMaximalSubarrays.getRanges(2), [{start: 0, end: 2, sum: 2}, {start: 3, end: 5, sum: 2}]);
  test = [1, 2, 1, 5, 1, 3];
  kMaximalSubarrays = new KMaximalGains(test);
  assert.deepEqual(kMaximalSubarrays.getRanges(2), [{start: 2, end: 3, sum: 4}, {start: 4, end: 5, sum: 2}]);
  test = [1, 2, 3, 4, 5, 6];
  kMaximalSubarrays = new KMaximalGains(test);
  assert.deepEqual(kMaximalSubarrays.getRanges(2), [, {start: 0, end: 5, sum: 5}]);
  test = [6, 5, 4, 3, 2, 1];
  kMaximalSubarrays = new KMaximalGains(test);
  assert.deepEqual(kMaximalSubarrays.getRanges(2), []);
  test = [1, 3, 1, 5, 1, 2];
  kMaximalSubarrays = new KMaximalGains(test);
  assert.deepEqual(kMaximalSubarrays.getRanges(2), [{start: 0, end: 1, sum: 2}, {start: 2, end: 3, sum: 4}]);
  test = [1, 3, 1, 5, 1, 2, 1, 4];
  kMaximalSubarrays = new KMaximalGains(test);
  assert.deepEqual(kMaximalSubarrays.getRanges(2), [{start: 2,end: 3, sum: 4}, {start: 6, end: 7, sum: 3}]);
};

if (require.main === module) {
  main();
}
