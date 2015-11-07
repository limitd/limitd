var Redis = require('ioredis');
var Redlock = require('redlock');
var _ = require('lodash');

function BucketDB (bucket_name, redis, redlock) {
  this._redis = redis;
  this._bucket_name = bucket_name,
  this._redlock = redlock;
}

BucketDB.prototype.get_and_lock = function (key, callback) {
  var lock_name = [this._bucket_name, '_locks', key].join(':');
  var self = this;

  return self._redlock.lock(lock_name, 100, function(err, lock) {
    if (err) {
      return callback(err);
    }
    return self.get(key, function (err, value) {
      return callback(err, value, lock.unlock.bind(lock));
    });
  });
};

BucketDB.prototype.put = function (key, value, options, callback) {
  var redis_key = this._bucket_name + ':' + key;

  if (typeof options === 'function') {
    callback = options;
    options = undefined;
  }

  if (!options || !options.ttl) {
    return this._redis.set(redis_key, JSON.stringify(value), callback);
  }
  this._redis.set(redis_key, JSON.stringify(value), 'PX', options.ttl, callback);
};

BucketDB.prototype.get = function (key, callback) {
  var redis_key = this._bucket_name + ':' + key;

  return this._redis.get(redis_key, function (err, value) {
    if (err || !value) {
      return callback(err);
    }
    callback(null, JSON.parse(value));
  });
};

BucketDB.prototype.list = function (key, callback) {
  var redis_key = this._bucket_name + ':' + key;
  var self = this;
  var prefix = self._redis.options && self._redis.options.keyPrefix;

  if (prefix) {
    redis_key = prefix + redis_key;
  }

  var stream = self._redis.scanStream({
    match: redis_key + '*',
    count: 10
  });

  var keys = [];

  stream.on('data', function (k) {
    keys = keys.concat(k);
  }).once('end', function () {
    keys = !prefix ? keys : keys.map(function (key) {
                              return key.replace(prefix, '');
                            });

    self._redis.mget(keys, function (err, results) {
      if (err || !results) {
        return callback(err);
      }

      var result = keys.reduce(function (result, key, index) {
        var original_key = key.replace(self._bucket_name + ':', '');
        result[original_key] = JSON.parse(results[index]);
        return result;
      }, {});

      callback(null, result);
    });

  }).once('error', callback);
};


module.exports = function (dbOptions) {
  var redis = new Redis(dbOptions);
  var redlock = new Redlock(
    [redis],
    {
      retryCount:  300,
      retryDelay:  5
    }
  );

  return {
    create: function (bucket_name) {
      return new BucketDB(bucket_name, redis, redlock);
    }
  };
};