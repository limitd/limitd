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
  this._storage.createReadStream({
    gte: key,
    lte: key + '~',
    limit: 100
  }).on('data', function (data) {
    if (!data.value) return;

    result[data.key] = JSON.parse(data.value);
  }).once('end', function () {
    callback(null, result);
  }).once('error', callback);
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