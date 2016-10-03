var level  = require('level');
var ttl    = require('level-ttl');
var serial = require('level-serial');
var spaces = require('level-spaces');
var ms = require('ms');

function BucketDB (storage) {
  this._storage = storage;
}

BucketDB.prototype.get_and_lock = function (key, callback) {
  return this._storage.serial(key, function (err, value, unlock) {
    return callback(err, value && JSON.parse(value), unlock && function (done) {
      unlock();
      done();
    });
  });
};

BucketDB.prototype.put = function (key, value, options, callback) {
  return this._storage.put(key, value, options, callback);
};

BucketDB.prototype.get = function (key, value, options, callback) {
  return this._storage.get(key, value, options, function (err, value) {
    callback(err, value && JSON.parse(value));
  });
};

BucketDB.prototype.list = function (key, callback) {
  var result = {};
  var count = 0;

  var readStream = this._storage.createReadStream({
    gte: key,
    lte: key + '~',
  });

  var finish =  function () {
    callback(null, result);
  };

  readStream.on('data', function (data) {
    if (!data.value) return;
    var parsed = JSON.parse(data.value);

    if (parsed.reset === 0 && parsed.content === parsed.size) {
      //we dont care about this.
      return;
    }
    count++;
    result[data.key] = parsed;

    if (count === 100) {
      this.destroy();
      finish();
    }

  }).once('end', finish).once('error', callback);
};


module.exports = function (dbPath) {
  var db = level(dbPath, { valueEncoding: 'json' });

  db = ttl(db, {
    checkFrequency: process.env.NODE_ENV === 'test' ? 100 : ms('30s')
  });

  return {
    create: function (bucket_name) {
      var storage = serial(spaces(db, bucket_name, { valueEncoding: 'json' }));
      return new BucketDB(storage);
    }
  };
};
