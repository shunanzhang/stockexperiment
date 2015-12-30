var createContract = require('ibapi').contract.createContract;
var GoogleCSVReader = require('./googleCSVReader');
var TradeController = require('./tradeController');

var MAX_INT = 0x7FFFFFFF; // max 31 bit
var MIN_INT = -0x7FFFFFFE; // negative max 31 bit

var EXCHANGES = {
  NFLX: 'NASDAQ',
  AAPL: 'NASDAQ'
};

var MIN_PRICES = {
  NFLX: 85.00,
  AAPL: 85.00
};

var MAX_POSITIONS = {
  NFLX: 800,
  AAPL: 800
};

var cancelId = 0;

var Company = module.exports = function(symbol) {
  if (! (this instanceof Company)) { // enforcing new
    return new Company(symbol);
  }
  this.symbol = symbol;
  this.minPrice = MIN_PRICES[symbol] || MAX_INT; // for flash crash
  this.maxPosition = MAX_POSITIONS[symbol] || 0;
  var googleCSVReader = new GoogleCSVReader(symbol);
  this.tradeController = new TradeController(googleCSVReader.columns, symbol);
  this.position = 0;
  this.low = MAX_INT;
  this.high = MIN_INT;
  this.close = 0.0;
  this.open = 0.0;
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
