var moment = require('moment-timezone');
var createContract = require('ibapi').contract.createContract;
var GoogleCSVReader = require('./googleCSVReader');
var TIMEZONE = GoogleCSVReader.TIMEZONE;
var TradeController = require('./tradeController');
var MAX_VALUE = Number.MAX_VALUE;
var MIN_VALUE = Number.MIN_VALUE;

var EXCHANGES = {
  SPY: 'ARCA',
  ES: 'GLOBEX'
};

var DESTINATIONS = {
  SPY: 'SMART',
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

var HARD_L_MAX_PERCENTS = {
  SPY: [1.019, 1.014, 1.009, 1.004, 0.999],
  ES: [1.019, 1.014, 1.009, 1.004, 0.999]
};

var HARD_L_MIN_PERCENTS = {
  SPY: [0.9, 0.9, 0.9, 0.9, 0.9],
  ES: [0.9, 0.9, 0.9, 0.9, 0.9]
};

var HARD_S_MIN_PERCENTS = {
  SPY: [0.961, 0.971, 0.981],
  ES: [0.981, 1.001, 1.021]
};

var HARD_S_MAX_PERCENTS = {
  SPY: [1.1, 1.1, 1.1],
  ES: [1.1, 1.1, 1.1]
};

var ONE_POSITIONS = {
  SPY: 184,
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
  this.hardLMaxPrices = [];
  this.hardLMinPrices = [];
  this.hardSMinPrices = [];
  this.hardSMaxPrices = [];
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
  contract.exchange = DESTINATIONS[symbol] || 'SMART';
  contract.primaryExchange = EXCHANGES[symbol];
  contract.currency = 'USD';
  var expir = EXPIRIES[symbol];
  if (expir) {
    var date = moment.tz(TIMEZONE);
    var rollWeek = ((date.date() - (date.day() + 3) % 7 + 1) / 7) | 0; // === 1 between Thursday 2nd week of month and Wednewsay 3rd week of month
    var diff = expir - (date.month() + 1) % expir;
    if (diff === expir && rollWeek < 2) {
      if (rollWeek < 1) {
        this.oldExpiry = this.newExpiry = contract.expiry = date.format('YYYYMM');
      } else {
        // The roll date is the second Thursday http://www.cmegroup.com/trading/equity-index/rolldates.html
        this.oldExpiry = date.format('YYYYMM');
        this.newExpiry = contract.expiry = date.add(diff, 'month').format('YYYYMM');
      }
    } else {
      this.oldExpiry = this.newExpiry = contract.expiry = date.add(diff, 'month').format('YYYYMM');
    }
  } else {
    this.oldExpiry = this.newExpiry = contract.expiry;
  }
  this.oldExpiryPosition = 0;
  this.lExLots = {};
  this.sExLots = {};
  this.cancelId = ++cancelId;
  this.lastOrderStatus = 'Filled';
  this.orderId = -1; // last order id
  this.tickSecond = 0;
};

Company.prototype.setCaps = function(dailyClose) {
  var symbol = this.symbol;
  var hardLMaxPercents = HARD_L_MAX_PERCENTS[symbol] || [];
  var hardLMinPercents = HARD_L_MIN_PERCENTS[symbol] || [];
  var hardSMinPercents = HARD_S_MIN_PERCENTS[symbol] || [];
  var hardSMaxPercents = HARD_S_MAX_PERCENTS[symbol] || [];
  var hardLMaxPrices = [];
  var hardLMinPrices = [];
  var hardSMinPrices = [];
  var hardSMaxPrices = [];
  var i = 0;
  for (i = hardLMaxPercents.length; i--;) {
    hardLMaxPrices[i] = hardLMaxPercents[i] * dailyClose;
  }
  for (i = hardLMinPercents.length; i--;) {
    hardLMinPrices[i] = hardLMinPercents[i] * dailyClose;
  }
  for (i = hardSMinPercents.length; i--;) {
    hardSMinPrices[i] = hardSMinPercents[i] * dailyClose;
  }
  for (i = hardSMaxPercents.length; i--;) {
    hardSMaxPrices[i] = hardSMaxPercents[i] * dailyClose;
  }
  this.hardLMaxPrices = hardLMaxPrices;
  this.hardLMinPrices = hardLMinPrices;
  this.hardSMinPrices = hardSMinPrices;
  this.hardSMaxPrices = hardSMaxPrices;
};

Company.prototype.popExLot = function() {
  var oldExpiryPosition = this.oldExpiryPosition;
  if (oldExpiryPosition === 0) {
    return undefined;
  }
  var exLots = (oldExpiryPosition > 0) ? this.lExLots : this.sExLots;
  for (var oId in exLots) {
    var order = exLots[oId];
    if (order) {
      delete exLots[oId];
      this.oldExpiryPosition += (oldExpiryPosition > 0) ? -1 : 1;
      return {oId: parseInt(oId, 10), order: order};
    }
  }
  return undefined;
};

Company.prototype.resetLowHigh = function() {
  this.low = MAX_VALUE;
  this.high = MIN_VALUE;
};

Company.prototype.resetLowHighCloseOpen = function() {
  this.resetLowHigh();
  this.open = 0.0;
};

if (!module.parent) {
  var company = new Company('ES');
  company.lExLots[1] = '1';
  company.oldExpiryPosition += 1;
  company.lExLots[2] = '2';
  company.oldExpiryPosition += 1;
  company.sExLots[3] = '3';
  company.oldExpiryPosition -= 1;
  console.log(company);
  console.log(company.popExLot());
  console.log(company.popExLot());
  company.lExLots[4] = '4';
  company.oldExpiryPosition += 1;
  console.log(company.popExLot());
}
