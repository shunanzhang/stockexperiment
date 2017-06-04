var assert = require('assert');
var addon = require('./build/Release/addon');
var Sma = require('./sma');
var TradeController = require('./tradeController');

var sma = new addon.Sma(4);
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

var i = 0;
sma = new addon.Sma(30);
var sma2 =new Sma(30);
var rand = Math.random;
console.time('sma');
for (i = 1000000; i--;) {
  var r = rand();
  sma.push(r);
  sma2.push(r);
  //sma.ave;
  //sma.up;
  //sma.down;
}
assert.deepEqual(sma.ave, sma2.ave);
assert.deepEqual(sma.down, sma2.down);
assert.deepEqual(sma.up, sma2.up);
console.timeEnd('sma');

var tradeController = new addon.TradeController();
var tradeController2 = new TradeController();
console.time('tradeController');
for (i = 1000000; i--;) {
  var close = rand();
  var high = rand();
  var low = rand();
  var a = tradeController.tradeLogic(close, high, low, false, true);
  var b = tradeController2.tradeLogic(close, high, low, 0.0, false, true);
  assert.deepEqual(a, b);
}
console.timeEnd('tradeController');
console.log(addon.TradeController.BUY);
console.log(addon.TradeController.SELL);
console.log(addon.TradeController.HOLD);
console.log(addon.TradeController.OFFSET);
console.log(addon.TradeController.OFFSET_POS);
console.log(addon.TradeController.OFFSET_NEG);
