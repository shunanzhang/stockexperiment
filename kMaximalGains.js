var assert = require('assert');

var Subarray = function(start, end, sum) {
  if (! (this instanceof Subarray)) { // enforcing new
    return new Subarray(start, end, sum);
  }
  this.start = start; // inclusive
  this.end = end; // inclusive
  this.sum = sum;
};

var isInRange = function(i, subarrays, buy, sell) {
  for (var j = subarrays.length; j--;) {
    var subarray = subarrays[j];
    if (i >= subarray.start && i < subarray.end) {
      return buy;
    }
  }
  return sell;
};

var KMaximalGains = module.exports = function(prices) {
  if (! (this instanceof KMaximalGains)) { // enforcing new
    return new KMaximalGains(prices);
  }
  this.prices = prices;
};
KMaximalGains.isInRange = isInRange;

KMaximalGains.prototype.getRanges = function(k, start, end) { // start and end are inclusive
  // This is O(n * k) computation, O(k) memory
  // https://leetcode.com/discuss/25603/a-concise-dp-solution-in-java

  var results = [];
  var prices = this.prices;
  var len = prices.length;

  if (!end || end > len) {
    end = len - 1;
  }
  if (!start) {
    start = 0;
  }

  if (end - start <= 0 || k >= ((end - start + 1) / 2)) { // k >= (len / 2) means we buy/sell at every price gap, which is not the focus
    return results;
  }

  var i = 0;
  var j = start;
  var buy = start;
  var sell = start;
  var dp = []; // dynamic programming table
  var balances = [];
  for (i = k + 1; i--;) { // 0 <= i <= k
    dp[i] = 0;
    balances[i] = -prices[start];
  }

  for (j = start + 1; j <= end; j++) {
    var price = prices[j];
    for (i = k + 1; --i;) { // 0 < i <= k
      var prevBalance = balances[i];
      var nextBalance = dp[i - 1] - price;
      var prevGain = dp[i];
      var nextGain = price + prevBalance;
      if (prevGain < nextGain) { // whether to sell at price
        dp[i] = nextGain;
        sell = j;
      } else {
        dp[i] = prevGain;
      }
      if (prevBalance > nextBalance) { // whether to buy at price
        balances[i] = prevBalance;
      } else {
        balances[i] = nextBalance;
        buy = j;
      }

      if (i === k && sell > buy) { // tracing back the buy sell history
        var sum = prices[sell] - prices[buy];
        var newSubarray = new Subarray(buy, sell, sum);
        // for loop to keep the sorted results
        // TODO change it to binary search
        for (var m = 0; m < k; m++) {
          var result = results[m];
          if (result === undefined) {
            results[m] = newSubarray;
            break;
          } else if (result.start === newSubarray.start) {
            if (result.sum < newSubarray.sum) {
              results.splice(m, 1, newSubarray); // replace the current subarray
            }
            break;
          } else if (result.sum < newSubarray.sum) {
            results.splice(m, 0, newSubarray); // insert the new subarray
            for (var n = m + 1, l = results.length; n < l; n++) { // find subsequent element that has the same start
              if (results[n].start === newSubarray.start) {
                results.splice(n, 1); // remove 1 element at n
                break;
              }
            }
            results.splice(k, 1); // remove 1 element if results.length is longer than k
            break;
          }
        } // end for loop
      }
    }
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
  assert.deepEqual(kMaximalSubarrays.getRanges(2), [{start: 0, end: 5, sum: 5}]);
  test = [6, 5, 4, 3, 2, 1];
  kMaximalSubarrays = new KMaximalGains(test);
  assert.deepEqual(kMaximalSubarrays.getRanges(2), []);
  test = [1, 3, 1, 5, 1, 2];
  kMaximalSubarrays = new KMaximalGains(test);
  assert.deepEqual(kMaximalSubarrays.getRanges(2), [{start: 2, end: 3, sum: 4}, {start: 0, end: 1, sum: 2}]);
  test = [1, 3, 1, 5, 1, 2, 1, 4];
  kMaximalSubarrays = new KMaximalGains(test);
  assert.deepEqual(kMaximalSubarrays.getRanges(2), [{start: 2, end: 3, sum: 4}, {start: 6, end: 7, sum: 3}]);
  test = [1, 2, 3, 4, 3, 2, 3, 5];
  kMaximalSubarrays = new KMaximalGains(test);
  assert.deepEqual(kMaximalSubarrays.getRanges(1), [{start: 0, end: 7, sum: 4}]);
  console.log('done');
};

if (require.main === module) {
  main();
}
