var Redis   = require('ioredis');
var _       = require('lodash');
var fs      = require('fs');
var path    = require('path');
var async   = require('async');

var DRIP_AND_TAKE_LUA_SCRIPT = fs.readFileSync(path.join(__dirname, 'drip_and_take.lua'), 'utf8');
// var TAKE_LUA_SCRIPT = fs.readFileSync(path.join(__dirname, 'take.lua'), 'utf8');
var TAKE_FROM_FIXED_LUA_SCRIPT = fs.readFileSync(path.join(__dirname, 'take_from_fixed.lua'), 'utf8');

function BucketDB (bucket_name, redis, redis_subscriber) {
  this._redis = redis;
  this._bucket_name = bucket_name;
  this._index_name = 'bucketidx';

  var self = this;
  if (redis_subscriber && redis_subscriber.listenerCount && redis_subscriber.listenerCount('pmessage') === 0) {
    redis_subscriber.on('pmessage', function(pattern, channel, message) {
      if (channel.match(/:expired$/)) {
        self.remove_from_index(message, _.noop);
      }
    });
  }
}

BucketDB.prototype.add_or_update_index = function (key, callback) {
  this._redis.zadd(this._index_name, 0, key).then(function(result_code) {
    callback(key, result_code);
  });
};

BucketDB.prototype.remove_from_index = function (key, callback) {
  var prefix = this._redis.options && this._redis.options.keyPrefix;
  prefix = prefix || '';
  this._redis.zrem(this._index_name, key.replace(prefix, '')).then(function(result_code) {
    callback(result_code);
  });
};

BucketDB.prototype.drip_and_take = function (key, params, count, callback) {
  var self = this;
  self.add_or_update_index(this._bucket_name + ':' + key, function (key) {
    self._redis.drip_and_take(key, +new Date(), params.per_interval / params.interval, params.size, count, function (err, result) {
      if (err) return callback(err);
      callback(null, !!result[2], {
        lastDrip: parseInt(result[0], 10),
        content:  parseInt(result[1], 10),
        size:     params.size
      });
    });
  });
};

BucketDB.prototype.take_from_fixed = function (key, params, count, callback) {
  var self = this;
  self.add_or_update_index(this._bucket_name + ':' + key, function (key) {
    self._redis.take_from_fixed(key, params.size, count, function (err, result) {
      if (err) return callback(err);
      callback(null, result);
    });
  });
};

BucketDB.prototype.get = function (key, callback) {
  var redis_key = this._bucket_name + ':' + key;
  var self = this;

  return self._redis.get(redis_key, function (err, value) {
    if (!err && !value) {
      return self.remove_from_index(redis_key, function() {
        callback(err);
      });
    }
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

  this._redis.zrangebylex(this._index_name, '[' + redis_key, '[' + redis_key + '\xff', function(err, keys) {
    if (err) return callback(err);

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

  });
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

  // a subscriber needs to be in a different connection
  var redis_subscriber = new Redis(dbOptions);
  redis_subscriber.psubscribe('__key*__:*', _.noop);

  return {
    create: function (bucket_name) {
      return new BucketDB(bucket_name, redis, redis_subscriber);
    }
  };
};