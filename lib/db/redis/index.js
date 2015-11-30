var Redis   = require('ioredis');
var _       = require('lodash');
var fs      = require('fs');
var path    = require('path');
var async   = require('async');

var DRIP_AND_TAKE_LUA_SCRIPT = fs.readFileSync(path.join(__dirname, 'drip_and_take.lua'), 'utf8');
// var TAKE_LUA_SCRIPT = fs.readFileSync(path.join(__dirname, 'take.lua'), 'utf8');
var TAKE_FROM_FIXED_LUA_SCRIPT = fs.readFileSync(path.join(__dirname, 'take_from_fixed.lua'), 'utf8');

function BucketDB (bucket_name, redis) {
  this._redis = redis;
  this._bucket_name = bucket_name;
}

BucketDB.prototype.drip_and_take = function (key, params, count, callback) {
  this._redis.drip_and_take(this._bucket_name + ':' + key, +new Date(), params.per_interval / params.interval, params.size, count, function (err, result) {
    if (err) return callback(err);
    return callback(null, !!result[2], {
      lastDrip: parseInt(result[0], 10),
      content:  parseInt(result[1], 10),
      size:     params.size
    });
  });
};

BucketDB.prototype.take_from_fixed = function (key, params, count, callback) {
  this._redis.take_from_fixed(this._bucket_name + ':' + key, params.size, count, function (err, result) {
    if (err) return callback(err);
    callback(null, result);
  });
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
    count: 1000
  });

  var keys = [];

  stream.on('data', function (k) {
    keys = keys.concat(k);
  }).once('end', function () {
    keys = !prefix ? keys : keys.map(function (key) {
                              return key.replace(prefix, '');
                            });

    if (!keys || keys.length === 0) {
      return callback(null, {});
    }

    async.map(keys, function (key, done) {
      var instance = key.substr(self._bucket_name.length + 1);

      self._redis.hgetall(key, function (err, bucket) {
        if (err && err.message.indexOf('WRONGTYPE Operation against') > -1) {
          return self._redis.get(key, function (err, content) {
            var result = {
              instance: instance,
              lastDrip: 0,
              content:  parseInt(content, 10)
            };

            done(null, result);
          });
        }

        if (err) {
          return done(err);
        }


        var result = {
          instance: instance,
          lastDrip: parseInt(bucket.last_drip, 10),
          content:  parseInt(bucket.content, 10)
        };

        done(null, result);
      });
    }, function (err, results) {
      if (err) return callback(err);
      var result = results.reduce(function (result, current) {
        result[current.instance] = current;
        return result;
      }, {});

      callback(null, result);
    });

  }).once('error', callback);
};


module.exports = function (dbOptions) {
  var redis;

  if (Array.isArray(dbOptions.nodes)) {
    redis = new Redis.Cluster(dbOptions.nodes, _.omit(dbOptions, ['nodes']));
  } else {
    redis = new Redis(dbOptions);
  }

  redis.defineCommand('drip_and_take', {
    lua: DRIP_AND_TAKE_LUA_SCRIPT,
    numberOfKeys: 1
  });

  redis.defineCommand('take_from_fixed', {
    lua: TAKE_FROM_FIXED_LUA_SCRIPT,
    numberOfKeys: 1
  });

  return {
    create: function (bucket_name) {
      return new BucketDB(bucket_name, redis);
    }
  };
};