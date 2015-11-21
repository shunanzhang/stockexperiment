var fs = require('fs');
var request = require('request');
var ByLineStream = require('./byLineStream');
var GoogleCSVReader = require('./googleCSVReader');
var CLOSE_COLUMN = GoogleCSVReader.CLOSE_COLUMN;
var TradeController = require('./tradeController');

var INTERVAL = 60; // sec
var PERIOD = 20; // days

var BUY = TradeController.BUY;
var SELL = TradeController.SELL;
var HOLD = TradeController.HOLD;
var MINUTES_DAY = TradeController.MINUTES_DAY;
var TRAIN_INTERVAL = TradeController.TRAIN_INTERVAL;
var TRAIN_LEN = TradeController.TRAIN_LEN;

/**
 * argument parsing
 */
var tickerId = process.argv[2] || 'NFLX';
var readNewData = process.argv[3];

var googleCSVReader = new GoogleCSVReader(tickerId);
var url = ['http://www.google.com/finance/getprices?i=', INTERVAL, '&p=', PERIOD, 'd&f=d,o,h,l,c,v&df=cpct&q=', tickerId.toUpperCase()].join('');

var backtest = function() {
  var data = googleCSVReader.data;
  var dataLen = data.length;
  var closes = googleCSVReader.getColumnData(CLOSE_COLUMN);
  var tradeController = new TradeController(googleCSVReader.columns, closes);
  tradeController.supervise(TRAIN_LEN - 1);

  var success = 0;
  var testSize = 0;
  var tp = 0;
  var fp = 0;
  var fn = 0;
  var bought = 0;
  var gain = 0;
  var featureVectorHistory = [];
  var resultHistory = [];
  var gains = [];
  var pGain = 0;
  var nGain = 0;
  for (var i = 0; i < dataLen; i++) {
    var datum = data[i];
    var i_MINUTES_DAY = i % MINUTES_DAY;
    var featureVector = tradeController.getFeatureVector(datum);
    var isTraining = (i % TRAIN_INTERVAL >= TRAIN_INTERVAL - 10) || (i === dataLen - 1);
    var result = '';
    featureVectorHistory.push(featureVector);
    if (i >= TRAIN_LEN) {
      // always sell a the end of the day
      var newClose = closes[i];
      var noPosition = isTraining || (i_MINUTES_DAY < 4) || (i_MINUTES_DAY >= MINUTES_DAY - 35);
      result = tradeController.trade(featureVector, noPosition);
      resultHistory.push(result);
      if ((result === BUY && bought <= 0) || (result === HOLD && bought < 0)) {
        if (bought < 0) {
          gains.push(bought + newClose);
          gain -= bought + newClose;
          if (gains[gains.length - 1] > 0) {
            pGain += 1;
          } else {
            nGain += 1;
          }
          //console.log(gain);
          console.log(BUY, i, newClose, -(bought + newClose), gain);
        }
        if (result === BUY) {
          bought = newClose;
        } else {
          bought = 0;
        }
      } else if ((result === SELL && bought >= 0) || (result === HOLD && bought > 0)) {
        if (bought > 0) {
          gains.push(newClose - bought);
          gain += newClose - bought;
          if (gains[gains.length - 1] > 0) {
            pGain += 1;
          } else {
            nGain += 1;
          }
          //console.log(gain);
          console.log(SELL, i, newClose, newClose - bought, gain);
        }
        if (result === SELL) {
          bought = -newClose;
        } else {
          bought = 0;
        }
      }
      if (isTraining) {
        tradeController.supervise(i);
      }
    }
    if (isTraining) {
      //for (var j = featureVectorHistory.length; j--;) {
      for (var j = TRAIN_INTERVAL; j--;) {
        featureVector = featureVectorHistory.shift();
        if (!featureVector) {
          break;
        }
        var correctResult = tradeController.train(i - j, featureVector);
        result = resultHistory.shift();
        if (result) {
          testSize += 1;
          if (result === correctResult) {
            success += 1;
            if (result === BUY) {
              tp += 1;
            }
          } else {
            if (result === BUY) {
              fp += 1;
            } else if (result === HOLD) {
              fn += 1;
            }
          }
        }
      }
    }
  }
  var precision = tp / (tp + fp);
  var recall = tp / (tp + fn);
  var aveGain = 0;
  var variance = 0;
  for (i = gains.length; i--;) {
    aveGain += gains[i];
  }
  aveGain /= gains.length;
  for (i = gains.length; i--;) {
    variance += Math.pow(aveGain - gains[i], 2);
  }
  variance /= gains.length;
  console.log('size:', dataLen);
  console.log(tickerId);
  console.log('accuracy:', success, '/', testSize, '=', 100.0 * success / testSize, '%');
  console.log('precision:', tp, '/(', tp, '+', fp, ') =', 100.0 * precision, '%');
  console.log('recall:', tp, '/(', tp, '+', fn, ') =', 100.0 * recall, '%');
  console.log('f1 score: =', 200.0 * precision * recall / (precision + recall), '%');
  console.log('elapsed:', (dataLen - TRAIN_LEN) / MINUTES_DAY | 0, 'days, ', (dataLen - TRAIN_LEN) % MINUTES_DAY, 'minutes');
  console.log('gain:', gain, ', per day =', 100.0 * gain / closes[TRAIN_LEN] / (dataLen - TRAIN_LEN) * MINUTES_DAY, '%');
  console.log('pGain/(pGain+nGain):', pGain / (pGain + nGain));
  console.log('sigma:', Math.sqrt(variance), 'ave gain:', aveGain, '# trades: ', gains.length);
  console.log('buy and hold:', closes[dataLen - 1] - closes[TRAIN_LEN]);

  googleCSVReader.shutdown();
};

var loadAndBacktest = function() {
  googleCSVReader.load(backtest);
};

if (readNewData) {
  request(url)
  //fs.createReadStream(__dirname + '/nflx20150927.txt')
  //fs.createReadStream(__dirname + '/nflx20151001.txt')
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
