var INTRADAY_DB = 2; // http://www.rediscookbook.org/multiple_databases.html
var options = {
  return_buffers: true
};
var port = null;
var host = null;

var redis = module.exports = require('redis').createClient(port, host, options);

redis.on('error', function(err) {
  console.error('Redis:', err);
});

var checkDb = function() {
  redis.select(INTRADAY_DB, function(err, res) {
    if (err) {
      setImmediate(checkDb);
    }
  });
};
checkDb();

Uint32Array.prototype.toBuffer = function() {
  return new Buffer(new Uint8Array(this.buffer, this.byteOffset, this.byteLength));
};
Buffer.prototype.toUint32Array = function() {
  var view = new Uint8Array(this);
  return new Uint32Array(view.buffer, view.byteOffset);
};

redis.saveIntraday = function(tickerId, dateColumnIndex, lines, callback) {
  var kv = {};
  for (var i = lines.length; i--;) {
    var line = lines[i];
    var lineLen = line.length;
    var data = new Uint32Array(lineLen);
    for (var j = lineLen; j--;) {
      data[j] = line[j];
    }
    kv[line[dateColumnIndex]] = data.toBuffer();
  }
  this.hmset(tickerId, kv, callback);
};

redis.loadIntraday = function(tickerId, callback) {
  this.hgetall(tickerId, function(err, kv) {
    if (err) {
      callback(err);
    } else {
      var lines = [];
      var dates = Object.keys(kv || {});
      dates.sort(function(a, b) {
        return parseInt(a, 10) - parseInt(b, 10);
      });
      for (var i = dates.length; i--;) {
        lines[i] = kv[dates[i]].toUint32Array();
      }
      callback(null, lines);
    }
  });
};
