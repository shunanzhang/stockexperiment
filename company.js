var moment = require('moment-timezone');
var createContract = require('ibapi').contract.createContract;
var GoogleCSVReader = require('./googleCSVReader');
var TradeController = require('./tradeController');
var TIMEZONE = GoogleCSVReader.TIMEZONE;
var MAX_VALUE = Number.MAX_VALUE;
var MIN_VALUE = Number.MIN_VALUE;

var EXCHANGES = {
  SPY: 'ARCA',
  ES: 'GLOBEX'
};

var SEC_TYPES = {
  SPY: 'STK',
  ES: 'FUT'
};

var EXPIRIES = {
  ES: 3
};

var MAX_LOTS = {
  SPY: 2,
  ES: 2
};

var HARD_L_MAX_PRICES = {
  SPY: [213.83, 212.83, 211.83, 210.83, 209.83],
  ES: [2130.75, 2120.75, 2110.75, 2100.75, 2090.75]
};

var HARD_L_MIN_PRICES = {
  SPY: [201.87, 201.87, 201.87, 200.87, 199.87],
  ES: [2020.00, 2020.00, 2020.00, 2010.00, 2000.00]
};

var HARD_S_MIN_PRICES = {
  SPY: [196.17, 201.17, 203.17],
  ES: [1960.25, 2010.25, 2030.25]
};

var HARD_S_MAX_PRICES = {
  SPY: [202.13, 204.13, 210.13],
  ES: [2020.00, 2040.00, 2100.00]
};

var ONE_POSITIONS = {
  SPY: 180,
  ES: 1
};

var ONE_TICKS = {
  SPY: 0.01,
  ES: 0.25
};

var cancelId = 0;

var Company = module.exports = function(symbol) {
  if (! (this instanceof Company)) { // enforcing new
    return new Company(symbol);
  }
  this.symbol = symbol;
  this.onePosition = ONE_POSITIONS[symbol] || 0;
  this.oneTickInverse = (1.0 / (ONE_TICKS[symbol] || 0.01));
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
  contract.secType = SEC_TYPES[symbol] || 'STK';
  contract.exchange = 'SMART';
  contract.primaryExchange = EXCHANGES[symbol];
  contract.currency = 'USD';
  var expir = EXPIRIES[symbol];
  if (expir) {
    var date = moment.tz(TIMEZONE);
    var diff = expir - (date.month() + 1) % expir;
    contract.expiry = date.clone().add(diff, 'month').format('YYYYMM');
    if (diff === expir) {
      this.oldExpiry = date.format('YYYYMM');
    } else {
      this.oldExpiry = contract.expiry;
    }
  }
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
