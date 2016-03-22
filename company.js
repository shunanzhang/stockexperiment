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
  SPY:  160.00
};

var MAX_PRICES = {
  SPY:  204.86
};

var MAX_POSITIONS = {
  NFLX: 200,
  AAPL: 600,
  AMZN: 100,
  SPY: 360
};

var ONE_POSITIONS = {
  SPY: 120
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
  this.minPrice = MIN_PRICES[symbol] || MAX_INT; // for flash crash
  this.maxPrice = MAX_PRICES[symbol] || MIN_INT;
  this.maxPosition = MAX_POSITIONS[symbol] || 0;
  this.onePosition = ONE_POSITIONS[symbol] || 0;
  var googleCSVReader = new GoogleCSVReader(symbol);
  this.tradeController = new TradeController(googleCSVReader.columns, this.command);
  this.position = 0;
  this.low = MAX_INT;
  this.high = MIN_INT;
  this.close = 0.0;
  this.open = 0.0;
  this.last = 0.0;
  this.positioning = false;
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
