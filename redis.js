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

Float64Array.prototype.toBuffer = function() {
  var arrayBuffer = this.buffer;
  arrayBuffer.length = this.length * 8;
  return new Buffer(arrayBuffer);
};
Buffer.prototype.toFloat64Array = function() {
  var length = this.length;
  var ab = new ArrayBuffer(length);
  var view = new Uint8Array(ab);
  for (var i = 0; i < length; ++i) {
    view[i] = this[i];
  }
  return new Float64Array(ab);
};

Uint32Array.prototype.toBuffer = function() {
  return new Buffer(new Uint8Array(this.buffer, this.byteOffset, this.byteLength));
};
Buffer.prototype.toUint32Array = function() {
  var view = new Uint8Array(this);
  return new Uint32Array(view.buffer, view.byteOffset);
};

redis.saveMatricies = function(tickerId, categories, fields, covarianceMatrix, weightMatrix, callback) {
  categories = categories || Object.keys(covarianceMatrix || {});
  var k = 0;
  var kv = {};
  for (var i = fields.length; i--;) {
    var field = fields[i];
    var data = new Float64Array(categories.length << 1);
    for (var j = categories.length; j--;) {
      var category = categories[j];
      k = j << 1;
      data[k] = covarianceMatrix.getOrDefault(category).getOrDefault(field);
      data[k + 1] = weightMatrix.getOrDefault(category).getOrDefault(field);
    }
    kv[field] = data.toBuffer();
  }
  this.hmset(tickerId, kv, callback);
};

redis.loadMatricies = function(tickerId, categories, callback) {
  this.hgetall(tickerId, function(err, kv) {
    if (err) {
      callback(err);
    } else {
      var covarianceMatrix = {};
      var weightMatrix = {};
      var category = '';
      for (var i = categories.length; i--;) {
        category = categories[i];
        covarianceMatrix[category] = {};
        weightMatrix[category] = {};
      }
      var fields = Object.keys(kv || {});
      var field = '';
      for (i = fields.length; i--;) {
        field = fields[i];
        var data = kv[field].toFloat64Array();
        for (var j = categories.length; j--;) {
          category = categories[j];
          var k = j << 1;
          var covariance = data[k];
          var weight = data[k + 1];
          if (covariance !== 1.0 || weight !== 0.0) {
            covarianceMatrix[category][field] = covariance;
            weightMatrix[category][field] = weight;
          }
        }
      }
      callback(null, {
        covarianceMatrix: covarianceMatrix,
        weightMatrix: weightMatrix
      });
    }
  });
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
