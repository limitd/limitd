var _ = require('lodash');

function BucketClass (db, options) {
  this._db = db;
  this._options = options;

  if (this._options.interval) {
    this._ttl = this._options.size * this._options.interval / this._options.per_interval;
  }
}

/**
 * add the delta of tokens to the bucket.
 * copied from https://github.com/jhurliman/node-rate-limiter
 */
BucketClass.prototype._drip = function (bucket, params) {
  if (!params.per_interval) {
    return bucket;
  }

  var now = +new Date();
  var deltaMS = Math.max(now - bucket.lastDrip, 0);
  var dripAmount = deltaMS * (params.per_interval / params.interval);
  var content = Math.min(bucket.content + dripAmount, params.size);
  return { content: content, lastDrip: now, size: params.size };
};

BucketClass.prototype._getResetTimestamp = function (bucket, params) {
  if (!params.interval || !params.per_interval) return 0;

  var now = Math.floor((new Date()).getTime() / 1000);
  var missing = params.size - bucket.content;
  var reset = now + (params.interval  * (missing / params.per_interval));

  return reset;
};

BucketClass.prototype._getParams = function (instance) {
  var params = this._options.override && this._options.override[instance] ?
                _.extend({}, _.pick(this._options, ['per_interval', 'interval', 'size']), this._options.override[instance]) :
                this._options;
  return params;
};

BucketClass.prototype.removeToken = function (instance, count, done) {
  var self = this;
  var params = this._getParams(instance);

  self._db.serial(instance, function (err, current, release) {
    current = current && JSON.parse(current);

    var bucket = current ? self._drip(current, params) : {
      lastDrip: Date.now(),
      content:  params.size,
      size:     params.size,
    };

    if (bucket.content < count) {
      bucket.reset = self._getResetTimestamp(bucket, params);
      release();
      return done(null, false, bucket);
    }

    bucket.content -= count;
    bucket.reset = self._getResetTimestamp(bucket, params);

    self._db.put(instance, bucket, {
      ttl: self._ttl
    }, function (err) {
      release();
      if (err) return done(err);
      done(null, true, bucket);
    });
  });
};

BucketClass.prototype.waitToken = function (instance, count, done) {
  var self = this;
  var params = this._getParams(instance);

  self.removeToken(instance, count, function (err, conformant, bucket) {
    if (err) {
      return done(err);
    }

    if (conformant) {
      return done(null, false, bucket);
    }

    var required = (count - bucket.content);
    var minWait = Math.ceil(required * params.interval / params.per_interval);
    return setTimeout(function () {
      self.waitToken(instance, count, function (err, delayed, bucket) {
        if (err) return done(err);
        done(null, true, bucket);
      });
    }, minWait);
  });
};

BucketClass.prototype.putToken = function (instance, count, done) {
  var self = this;
  var params = this._getParams(instance);

  self._db.serial(instance, function (err, current, release) {
    current = current && JSON.parse(current);

    var bucket = current ? self._drip(current, params) : {
      lastDrip: Date.now(),
      size:     params.size,
    };

    bucket.content = count === true ? params.size : Math.max(params.size, count);
    bucket.reset = self._getResetTimestamp(bucket, params);

    self._db.put(instance, bucket, {
      ttl: self._ttl
    }, function (err) {
      release();
      if (err) return done(err);
      done(null, bucket);
    });
  });
};

module.exports = BucketClass;