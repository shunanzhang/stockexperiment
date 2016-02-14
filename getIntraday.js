var fs = require('fs');
var request = require('request');
var ByLineStream = require('./byLineStream');
var GoogleCSVReader = require('./googleCSVReader');
var CLOSE_COLUMN = GoogleCSVReader.CLOSE_COLUMN;
var TradeController = require('./tradeController');
var MIN_INT = require('./utils').MIN_INT;

var INTERVAL = 60; // sec
var PERIOD = 20; // days

var BUY = TradeController.BUY;
var SELL = TradeController.SELL;
var HOLD = TradeController.HOLD;
var MINUTES_DAY = TradeController.MINUTES_DAY;

/**
 * argument parsing
 */
var tickerId = process.argv[2] || 'SPY';
var readNewData = process.argv[3];

var googleCSVReader = new GoogleCSVReader(tickerId);
var url = ['http://www.google.com/finance/getprices?i=', INTERVAL, '&p=', PERIOD, 'd&f=d,o,h,l,c,v&df=cpct&q=', tickerId.toUpperCase()].join('');

var backtest = function() {
  var data = googleCSVReader.data;
  var dataLen = data.length;
  var closes = googleCSVReader.getColumnData(CLOSE_COLUMN);
  var tradeController = new TradeController(googleCSVReader.columns);

  var bought = 0;
  var gain = 0;
  var gains = [];
  var pGain = 0;
  var nGain = 0;
  for (var i = 0; i < dataLen; i++) {
    var datum = data[i];
    var i_MINUTES_DAY = i % MINUTES_DAY;
    var newClose = closes[i];
    var noPosition = (i_MINUTES_DAY < 4) || (i_MINUTES_DAY >= MINUTES_DAY - 5);
    var lastOrder = (i_MINUTES_DAY >= MINUTES_DAY - 23);
    var giveup = (i_MINUTES_DAY >= MINUTES_DAY - 83);
    var displayTime = new Date(0, 0, 0, 9, 30 + i % MINUTES_DAY, 0, 0).toLocaleTimeString();
    var result = tradeController.trade(datum, noPosition, lastOrder, giveup);
    if ((result === BUY && bought <= 0) || (result === HOLD && bought < 0)) {
      if (bought < 0) {
        gains.push(-(bought + newClose) - 2); // take 1 cent off for round trip commission
        gain -= bought + newClose + 2;
        if (gains[gains.length - 1] > 0) {
          pGain += 1;
        } else {
          nGain += 1;
        }
        //console.log(gain);
        console.log('  ', BUY, displayTime, newClose, -(bought + newClose), gain, pGain / (pGain + nGain));
      }
      if (result === BUY) {
        bought = newClose;
        console.log('bought', displayTime, newClose);
      } else {
        bought = 0;
      }
    } else if ((result === SELL && bought >= 0) || (result === HOLD && bought > 0)) {
      if (bought > 0) {
        gains.push(newClose - bought - 2); // take 1 cent off for round trip commission
        gain += newClose - bought - 2;
        if (gains[gains.length - 1] > 0) {
          pGain += 1;
        } else {
          nGain += 1;
        }
        //console.log(gain);
        console.log(' ', SELL, displayTime, newClose, newClose - bought, gain, pGain / (pGain + nGain));
      }
      if (result === SELL) {
        bought = -newClose;
        console.log(' ', 'sold', displayTime, newClose);
      } else {
        bought = 0;
      }
    }
    if (i_MINUTES_DAY === MINUTES_DAY - 1) {
      console.log(new Date((datum[0] + 60 * 60 * 3) * 1000).toLocaleDateString());
      console.log('=====');
      //console.log(gain);
    }
  }
  var aveGain = 0;
  var variance = 0;
  var pg = 0;
  var ng = 0;
  var maxGain = MIN_INT;
  var maxDd = 0;
  for (i = 0; i < gains.length; i++) {
    aveGain += gains[i];
    if (gains[i] > 0) {
      pg += gains[i];
    } else if (gains[i] < 0) {
      ng += -gains[i];
    }
    maxGain = Math.max(aveGain, maxGain);
    maxDd = Math.min(aveGain - maxGain, maxDd);
    //console.log(i, aveGain, maxGain, maxDd);
  }
  aveGain /= gains.length;
  for (i = gains.length; i--;) {
    variance += Math.pow(aveGain - gains[i], 2);
  }
  variance /= gains.length;
  console.log('size:', dataLen);
  console.log(tickerId);
  console.log('elapsed:', dataLen / MINUTES_DAY | 0, 'days', dataLen % MINUTES_DAY, 'minutes');
  console.log('gain:', gain, 'per day =', 100.0 * gain / closes[0] / dataLen * MINUTES_DAY, '%');
  console.log('pGain/(pGain+nGain):', pGain / (pGain + nGain), 'kelly criterion:', pGain / (pGain + nGain) - nGain / (pGain + nGain) / ((pg / pGain) / (ng / nGain)));
  console.log('sigma:', Math.sqrt(variance), 'ave gain:', aveGain, 'ratio:', aveGain/Math.sqrt(variance), '# trades: ', gains.length);
  console.log('max draw down: ', maxDd);
  console.log('buy and hold:', closes[dataLen - 1] - closes[0], 'profit factor:', pg / ng, 'payoff ratio: ', (pg / pGain) / (ng / nGain));
  console.log('pGain*ave/sigma/days:', pGain * aveGain / Math.sqrt(variance) / (dataLen / MINUTES_DAY));

  googleCSVReader.shutdown();
};

var loadAndBacktest = function() {
  googleCSVReader.load(backtest);
};

if (readNewData) {
  request(url)
  .pipe(new ByLineStream()).on('readable', function() {
    googleCSVReader.parseLine(this.read());
  }).on('end', function() {
    googleCSVReader.save();
    loadAndBacktest();
  }).on('error', function(data) {
    googleCSVReader.shutdown();
    console.error(data);
  });
} else {
  loadAndBacktest();
}
