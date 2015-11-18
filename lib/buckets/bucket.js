var _ = require('lodash');

var MILLISECONDS_PER_SECOND = 1000;

function BucketType (db, options) {
  this._db = db;
  this._options = options;

  this._ttl = this._options.size * this._options.interval / this._options.per_interval;
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
  return { content: content, lastDrip: now, size: params.size };
};

BucketType.prototype._getResetTimestamp = function (bucket, params) {
  if (!params.per_interval) {
    return 0;
  }

  var now = new Date().getTime();
  var missing = params.size - bucket.content;
  var msToCompletion = Math.ceil(missing * params.interval / params.per_interval);

  return Math.ceil((now + msToCompletion) / MILLISECONDS_PER_SECOND);
};

BucketType.prototype._getParams = function (instance) {
  var override = this._options.override &&
                        this._options.override[instance] ||
                        _.values(this._options.override).filter(function (override) {
                          return override.match && !!override.match.exec(instance);
                        })[0];

  if (override) {
    return _.extend(_.pick(this._options, ['per_interval', 'interval', 'size']), override);
  }

  return this._options;
};

BucketType.prototype.removeToken = function (instance, count, done) {
  var self = this;
  var params = this._getParams(instance);

  self._db.get_and_lock(instance, function (err, current, release) {
    if (err && err.name !== 'NotFoundError') {
      return done(err);
    }

    var bucket = current ? self._drip(current, params) : {
      lastDrip: Date.now(),
      content:  params.size,
      size:     params.size,
    };

    if (bucket.content < count) {
      bucket.reset = self._getResetTimestamp(bucket, params);
      return release(function () {
        return done(null, false, bucket);
      });
    }

    bucket.content -= count;
    bucket.reset = self._getResetTimestamp(bucket, params);

    self._db.put(instance, bucket, {
      ttl: self._ttl
    }, function (err) {
      release(function () {
        if (err) return done(err);
        done(null, true, bucket);
      });
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

  self._db.get_and_lock(instance, function (err, current, release) {
    if (err && err.name !== 'NotFoundError') {
      return done(err);
    }

    var bucket = current ? self._drip(current, params) : {
      lastDrip: Date.now(),
      size:     params.size,
    };

    bucket.content = count === true ? params.size : (bucket.content || 0) + count;
    bucket.content = Math.min(bucket.content, params.size);
    bucket.reset = self._getResetTimestamp(bucket, params);

    self._db.put(instance, bucket, {
      ttl: self._ttl
    }, function (err) {
      release(function () {
        if (err) return done(err);
        done(null, bucket);
      });
    });
  });
};

BucketType.prototype.status = function (instance, done) {
  var self = this;
  var params = this._getParams(instance);

  self._db.list(instance, function (err, results) {
    if (err) return done(err);

    var buckets = _.map(results, function (current, key) {
      var bucket = self._drip(current, params);
      bucket.instance = key;
      bucket.reset = self._getResetTimestamp(bucket, params);
      return bucket;
    });

    done(null, buckets);
  });
};

module.exports = BucketType;