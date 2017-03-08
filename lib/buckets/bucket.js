var _                       = require('lodash');
var ms                      = require('ms');
var MILLISECONDS_PER_SECOND = 1000;
var GC_GRACE_PERIOD         = ms('2m');

function BucketType (db, options) {
  this._db = db;
  this._options = options;

  this._ttl = this._options.size * this._options.interval / this._options.per_interval;

  if (process.env.NODE_ENV !== 'test') {
    //do not expire
    this._ttl += GC_GRACE_PERIOD;
  }
}

/**
 * add the delta of tokens to the bucket.
 * copied from https://github.com/jhurliman/node-rate-limiter
 */
BucketType.prototype._drip = function (bucket, params) {
  if (!params.per_interval) {
    return bucket;
  }

  var now = +new Date();
  var deltaMS = Math.max(now - bucket.lastDrip, 0);
  var dripAmount = deltaMS * (params.per_interval / params.interval);
  var content = Math.min(bucket.content + dripAmount, params.size);
  return {
    content: content,
    lastDrip: now,
    size: params.size,
    beforeDrip: bucket.content,
    isNew: false
  };
};

BucketType.prototype._getResetTimestamp = function (bucket, params) {
  if (!params.per_interval) {
    return 0;
  }

  var now = Date.now();
  var missing = params.size - bucket.content;
  var msToCompletion = Math.ceil(missing * params.interval / params.per_interval);

  return Math.ceil((now + msToCompletion) / MILLISECONDS_PER_SECOND);
};

BucketType.prototype._getParams = function (instance) {
  var override = this._options.override &&
                        this._options.override[instance] ||
                        _.values(this._options.override).filter(function (override) {
                          return override.match &&
                                 !!override.match.exec(instance) &&
                                 (!override.until || override.until > new Date());
                        })[0];

  if (override && (!override.until || override.until > new Date())) {
    return _.extend(_.pick(this._options, ['per_interval', 'interval', 'size', 'unlimited']), override);
  }

  return this._options;
};

BucketType.prototype.removeToken = function (instance, count, done) {
  var self = this;
  var params = this._getParams(instance);

  if (params.unlimited) {
    return setImmediate(done, null, true, {
      lastDrip: Date.now(),
      content:  params.size,
      reset:    Math.floor(Date.now() / MILLISECONDS_PER_SECOND),
      size:     params.size
    });
  }

  if (!params.per_interval && self._db.take_from_fixed) {
    return self._db.take_from_fixed(instance, params, count, function (err, content) {
      if (err) {
        return done(err);
      }
      done(null, content !== null, {
        lastDrip: Date.now(),
        content: content,
        reset: 0,
        size: params.size
      });
    });
  }

  if (self._db.drip_and_take) {
    return self._db.drip_and_take(instance, params, count, function (err, enough, bucket) {
      if (err) {
        return done(err);
      }
      bucket.reset = self._getResetTimestamp(bucket, params);
      done(null, enough, bucket);
    });
  }

  self._db.get_and_lock(instance, function (err, current, release) {
    if (err && err.name !== 'NotFoundError') {
      return done(err);
    }

    var bucket = current ? self._drip(current, params) : {
      lastDrip: Date.now(),
      content:  params.size,
    };

    bucket.isNew = !!current;
    bucket.size = params.size;

    //this happen when we scale down a bucket
    //imagine the size of the Class was 10 and the current content is 9.
    //then we scale down the bucket to 6...
    //The current content should be computed as 6, not 9.
    bucket.content = Math.min(params.size, bucket.content);

    if (bucket.content < count) {
      release(_.noop);
      bucket.reset = self._getResetTimestamp(bucket, params);
      return done(null, false, bucket);
    }

    bucket.content -= count;
    bucket.reset = self._getResetTimestamp(bucket, params);

    self._db.put(instance, bucket, {
      ttl: self._ttl
    }, function (err) {
      release(_.noop);
      if (err) {
        return done(err);
      }
      done(null, true, bucket);
    });
  });
};

BucketType.prototype.waitToken = function (instance, count, done) {
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

BucketType.prototype.putToken = function (instance, count, done) {
  var self = this;
  var params = this._getParams(instance);
  count = count === true ? params.size : count;

  if (!params.per_interval && self._db.take_from_fixed) {
    return self._db.take_from_fixed(instance, params, count * -1, function (err, content) {
      if (err) {
        return done(err);
      }
      done(null, {
        lastDrip: Date.now(),
        content:  content,
        reset:    0,
        size:     params.size
      });
    });
  }

  if (self._db.drip_and_take) {
    return self._db.drip_and_take(instance, params, count * -1, function (err, enough, bucket) {
      if (err) {
        return done(err);
      }
      bucket.reset = self._getResetTimestamp(bucket, params);
      done(null, bucket);
    });
  }

  self._db.get_and_lock(instance, function (err, current, release) {
    if (err && err.name !== 'NotFoundError') {
      return done(err);
    }

    var bucket = current ? self._drip(current, params) : {
      lastDrip: Date.now(),
      content:  params.size,
    };

    bucket.isNew = !!current;
    bucket.size = params.size;
    bucket.content += count;
    bucket.content = Math.min(bucket.content, params.size);
    bucket.reset = self._getResetTimestamp(bucket, params);

    self._db.put(instance, bucket, {
      ttl: self._ttl
    }, function (err) {
      release(_.noop);
      if (err) return done(err);
      done(null, bucket);
    });
  });
};

BucketType.prototype.status = function (instance, done) {
  var self = this;

  self._db.list(instance, function (err, results) {
    if (err) return done(err);

    var buckets = _.map(results, function (current, instance) {
      var params = self._getParams(instance);
      var bucket = self._drip(current, params);
      bucket.size = params.size;
      bucket.instance = instance;
      bucket.reset = self._getResetTimestamp(bucket, params);
      return bucket;
    });

    done(null, buckets);
  });
};

module.exports = BucketType;
