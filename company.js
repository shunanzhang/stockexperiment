var createContract = require('ibapi').contract.createContract;
var GoogleCSVReader = require('./googleCSVReader');
var TradeController = require('./tradeController');
var MAX_VALUE = Number.MAX_VALUE;
var MIN_VALUE = Number.MIN_VALUE;

var EXCHANGES = {
  NFLX: 'NASDAQ',
  AAPL: 'NASDAQ',
  AMZN: 'NASDAQ',
  SPY: 'ARCA'
};

var MAX_LOTS = {
  SPY: 2
};

var HARD_L_MAX_PRICES = {
  SPY: [213.83, 205.83, 204.83, 203.83, 202.83]
};

var HARD_L_MIN_PRICES = {
  SPY: [203.87, 200.87, 199.87, 198.87, 197.87]
};

var HARD_S_MIN_PRICES = {
  SPY: [196.17, 200.17, 202.17]
};

var HARD_S_MAX_PRICES = {
  SPY: [201.13, 203.13, 208.13]
};

var ONE_POSITIONS = {
  SPY: 179
};

var cancelId = 0;

var Company = module.exports = function(symbol) {
  if (! (this instanceof Company)) { // enforcing new
    return new Company(symbol);
  }
  this.symbol = symbol;
  this.onePosition = ONE_POSITIONS[symbol] || 0;
  this.maxLot = MAX_LOTS[symbol] || 0;
  this.hardLMaxPrices = (HARD_L_MAX_PRICES[symbol] || []).sort().reverse();
  this.hardLMinPrices = (HARD_L_MIN_PRICES[symbol] || []).sort().reverse();
  this.hardSMinPrices = (HARD_S_MIN_PRICES[symbol] || []).sort();
  this.hardSMaxPrices = (HARD_S_MAX_PRICES[symbol] || []).sort();
  var googleCSVReader = new GoogleCSVReader(symbol);
  this.tradeController = new TradeController(googleCSVReader.columns);
  this.low = MAX_VALUE;
  this.high = MIN_VALUE;
  this.close = 0.0;
  this.open = 0.0;
  this.bid = 0.0;
  this.ask = 0.0;
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
