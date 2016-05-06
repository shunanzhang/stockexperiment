var createContract = require('ibapi').contract.createContract;
var GoogleCSVReader = require('./googleCSVReader');
var TradeController = require('./tradeController');
var L = TradeController.L;
var S = TradeController.S;
var MAX_VALUE = Number.MAX_VALUE;
var MIN_VALUE = Number.MIN_VALUE;

var EXCHANGES = {
  NFLX: 'NASDAQ',
  AAPL: 'NASDAQ',
  AMZN: 'NASDAQ',
  SPY: 'ARCA'
};

var MIN_PRICES = {
  SPY:  205.64
};

var MAX_PRICES = {
  SPY:  205.36
};

var MAX_LOTS = {
  SPY: 3
};

var HARD_L_MAX_LOTS = {
  SPY: 3
};

var HARD_S_MAX_LOTS = {
  SPY: 4
};

var ONE_POSITIONS = {
  SPY: 134
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
  this.minPrice = MIN_PRICES[symbol] || MAX_VALUE;
  this.maxPrice = MAX_PRICES[symbol] || MIN_VALUE;
  var onePosition = this.onePosition = ONE_POSITIONS[symbol] || 0;
  var maxLot = this.maxLot = MAX_LOTS[symbol] || 0;
  this.hardLMaxLot = HARD_L_MAX_LOTS[symbol] || 0;
  this.hardSMaxLot = HARD_S_MAX_LOTS[symbol] || 0;
  this.maxPosition = onePosition * maxLot || 0;
  var googleCSVReader = new GoogleCSVReader(symbol);
  this.tradeController = new TradeController(googleCSVReader.columns);
  this.position = 0;
  this.low = MAX_VALUE;
  this.high = MIN_VALUE;
  this.close = 0.0;
  this.open = 0.0;
  this.last = 0.0;
  this.positioning = false;
  this.lLots = {};
  this.sLots = {};
  this.lLotsLength = 0;
  this.sLotsLength = 0;
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
  this.low = MAX_VALUE;
  this.high = MIN_VALUE;
  this.close = 0.0;
};

Company.prototype.resetLowHighCloseOpen = function() {
  this.resetLowHighClose();
  this.open = 0.0;
};
