var createContract = require('ibapi').contract.createContract;
var GoogleCSVReader = require('./googleCSVReader');
var TradeController = require('./tradeController');
var L = TradeController.L;
var S = TradeController.S;
var utils = require('./utils');
var MAX_INT = utils.MAX_INT;
var MIN_INT = utils.MIN_INT;

var EXCHANGES = {
  NFLX: 'NASDAQ',
  AAPL: 'NASDAQ',
  AMZN: 'NASDAQ',
  SPY: 'ARCA'
};

var MIN_PRICES = {
  NFLX: 85.00,
  AAPL: 80.00,
  AMZN: 500.00,
  SPY:  200.14
};

var MAX_PRICES = {
  SPY:  204.86
};

var MAX_LOTS = {
  SPY: 3
};

var HARD_MAX_LOTS = {
  SPY: 6
};

var ONE_POSITIONS = {
  SPY: 131
};

var COMMANDS = {
  SPY: L
};

var cancelId = 0;

var Company = module.exports = function(symbol) {
  if (! (this instanceof Company)) { // enforcing new
    return new Company(symbol);
  }
  this.symbol = symbol;
  this.command = COMMANDS[symbol] || L;
  this.minPrice = MIN_PRICES[symbol] || MAX_INT;
  this.maxPrice = MAX_PRICES[symbol] || MIN_INT;
  var onePosition = this.onePosition = ONE_POSITIONS[symbol] || 0;
  var maxLot = this.maxLot = MAX_LOTS[symbol] || 0;
  this.hardMaxLot = HARD_MAX_LOTS[symbol] || 0;
  this.maxPosition = onePosition * maxLot || 0;
  var googleCSVReader = new GoogleCSVReader(symbol);
  this.tradeController = new TradeController(googleCSVReader.columns);
  this.position = 0;
  this.low = MAX_INT;
  this.high = MIN_INT;
  this.close = 0.0;
  this.open = 0.0;
  this.last = 0.0;
  this.positioning = false;
  this.lLots = {};
  this.sLots = {};
  var contract = this.contract = createContract();
  contract.symbol = symbol;
  contract.secType = 'STK';
  contract.exchange = 'SMART';
  contract.primaryExchange = EXCHANGES[symbol];
  contract.currency = 'USD';
  this.cancelId = ++cancelId;
  this.lastOrderStatus = 'Filled';
  this.orderId = -1; // last order id
};

Company.prototype.resetLowHighClose = function() {
  this.low = MAX_INT;
  this.high = MIN_INT;
  this.close = 0.0;
};

Company.prototype.resetLowHighCloseOpen = function() {
  this.resetLowHighClose();
  this.open = 0.0;
};
