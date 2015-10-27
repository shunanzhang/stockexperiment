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
  for (var i = 0; i < dataLen; i++) {
    var datum = data[i];
    var featureVector = tradeController.getFeatureVector(datum);
    var isTraining = (i % TRAIN_INTERVAL >= TRAIN_INTERVAL - 10) || (i === dataLen - 1);
    var result = '';
    featureVectorHistory.push(featureVector);
    if (i >= TRAIN_LEN) {
      var noPosition = isTraining || (i % MINUTES_DAY < 16) || (i % MINUTES_DAY >= MINUTES_DAY - 41);
      var forceSell = noPosition || ((closes[i] / closes[i - 1]) < 0.9969 && bought > 0);
      result = tradeController.trade(featureVector, forceSell); // always sell a the end of the day
      resultHistory.push(noPosition? undefined : result);
      if (result === BUY && bought <= 0) {
        if (bought < 0) {
          gain -= bought + closes[i];
          //console.log(gain);
          console.log(BUY, i, closes[i], -(bought + closes[i]), gain);
        }
        bought = closes[i];
      } else if (result === SELL && (bought >= 0 || noPosition)) {
        if (bought > 0) {
          gain += closes[i] - bought;
          //console.log(gain);
          console.log(SELL, i, closes[i], closes[i] - bought, gain);
        } else if (bought < 0 && noPosition) {
          gain -= bought + closes[i];
          console.log(BUY, i, closes[i], -(bought + closes[i]), gain);
        }
        if (noPosition) {
          bought = 0;
        } else {
          bought = -closes[i];
        }
      }
      if (isTraining) {
        tradeController.supervise(i);
      }
    }
    if (isTraining) {
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
            } else if (result === SELL) {
              fn += 1;
            }
          }
        }
      }
    }
  }
  var precision = tp / (tp + fp);
  var recall = tp / (tp + fn);
  console.log('size:', i);
  console.log(tickerId);
  console.log('accuracy:', success, '/', testSize, '=', 100.0 * success / testSize, '%');
  console.log('precision:', tp, '/(', tp, '+', fp, ') =', 100.0 * precision, '%');
  console.log('recall:', tp, '/(', tp, '+', fn, ') =', 100.0 * recall, '%');
  console.log('f1 score: =', 200.0 * precision * recall / (precision + recall), '%');
  console.log('elapsed:', (dataLen - TRAIN_LEN) / MINUTES_DAY | 0, 'days, ', (dataLen - TRAIN_LEN) % MINUTES_DAY, 'minutes');
  console.log('gain:', gain, ', per day =', 100.0 * gain / closes[TRAIN_LEN] / (dataLen - TRAIN_LEN) * MINUTES_DAY, '%');
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
