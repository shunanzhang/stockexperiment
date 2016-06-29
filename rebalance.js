var rebalance = module.exports = function(targets, close) {
  var len = targets.length;
  if (len < 3) {
    return;
  }
  var ave = 0.0;
  for (var i = 0; i < len; i++) {
    ave += targets[i];
  }
  ave /= len;
  var first = Math.max.apply(null, targets);
  if (first < close) { // short
    first = Math.min.apply(null, targets);
  }
  var step = (ave - first) * 2 / (len - 1);
  for (i = 0; i < len; i++) {
    targets[i] = first + step * i;
  }
};

if (!module.parent) {
  var targets = [212.60, 210.84, 210.90, 210.91];
  rebalance(targets, 210);
  console.log(targets);
  targets = [212.60, 210.84, 210.90, 210.91];
  rebalance(targets, 213);
  console.log(targets);
  targets = [];
  for (var i = 3; i < process.argv.length; i++) {
    targets.push(parseFloat(process.argv[i]));
  }
  console.log(targets);
  rebalance(targets, parseFloat(process.argv[2]));
  console.log(targets);
}
