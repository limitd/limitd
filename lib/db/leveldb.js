var level  = require('level');
var ttl    = require('level-ttl');
var serial = require('level-serial');
var spaces = require('level-spaces');

function BucketDB (storage) {
  this._storage = storage;
}

BucketDB.prototype.get_and_lock = function (key, callback) {
  return this._storage.serial(key, callback);
};

BucketDB.prototype.put = function (key, value, options, callback) {
  return this._storage.put(key, value, options, callback);
};

BucketDB.prototype.get = function (key, value, options, callback) {
  return this._storage.get(key, value, options, callback);
};

BucketDB.prototype.list = function (key, callback) {
  var result = {};
  this._storage.createReadStream({
    gte: key,
    lte: key + '~'
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
    checkFrequency: process.env.NODE_ENV === 'test' ? 100 : 10000
  });

  return {
    create: function (bucket_name) {
      var storage = serial(spaces(db, bucket_name, { valueEncoding: 'json' }));
      return new BucketDB(storage);
    }
  };
};