var moment = require('moment-timezone');
var GoogleCSVReader = require('./googleCSVReader');
var TIMEZONE = GoogleCSVReader.TIMEZONE;
var Company = require('./company');

var ibapi = require('ibapi');
var messageIds = ibapi.messageIds;

var api = new ibapi.NodeIbapi();
var orderId = -1;

var company = new Company('ES');
var contract = company.contract;

var baseTime = moment.tz('2016-06-01T16:00:00', TIMEZONE);
var duration = 10;
var endDateTime = baseTime.clone().add(duration + ((duration / 5) | 0) * 2, 'day').format('YYYYMMDD HH:mm:ss') + ' EST';

var requstData = function () {
  setImmediate(api.reqHistoricalData.bind(api, 1, contract, endDateTime, '' + duration + ' D', '1 min', 'TRADES', '0', '2'));
};

var handleValidOrderId = function (message) {
  orderId = message.orderId;
  console.log('INTERVAL=60\nCOLUMNS=DATE,CLOSE,HIGH,LOW,OPEN,VOLUME\na' + baseTime.unix());
  requstData();
};

var handleServerError = function (message) {
  console.log('Error:');
  console.log(JSON.stringify(message));
};

var handleClientError = function (message) {
  console.log('ClientError:');
  console.log(JSON.stringify(message));
};

var handleHistData = function (data) {
  if (data.date.toString().indexOf('finished') < 0) {
    console.log([(parseInt(data.date, 10) + 60 - baseTime.unix()) / 60, data.close, data.high, data.low, data.open, data.volume].join(','));
  }
};

api.handlers[messageIds.nextValidId] = handleValidOrderId;
api.handlers[messageIds.error] = handleServerError;
api.handlers[messageIds.clientError] = handleClientError;
api.handlers[messageIds.historicalData] = handleHistData;

var connected = api.connect('127.0.0.1', 7496, 0);

if (connected) {
  api.beginProcessing();
}
