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
BucketClass.prototype._drip = function (bucket) {
  if (!this._options.per_interval) {
    return bucket;
  }
  var now = +new Date();
  var deltaMS = Math.max(now - bucket.lastDrip, 0);
  var dripAmount = deltaMS * (this._options.per_interval / this._options.interval);
  var content = Math.min(bucket.content + dripAmount, this._options.size);
  return { content: content, lastDrip: now };
};

BucketClass.prototype.removeToken = function (instance, count, done) {
  var self = this;

  self._db.serial(instance, function (err, current, release) {
    current = current && JSON.parse(current);

    var bucket = current ? self._drip(current) : {
      lastDrip: Date.now(),
      content:  self._options.size
    };

    if (bucket.content < count) {
      release();
      return done(null, false, bucket);
    }

    bucket.content -= count;

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

  self.removeToken(instance, count, function (err, conformant, bucket) {
    if (err) {
      return done(err);
    }

    if (conformant) {
      return done(null, false);
    }

    var required = (count - bucket.content);
    var minWait = Math.floor(required * self._options.interval / self._options.per_interval);
    return setTimeout(function () {
      self.waitToken(instance, count, function (err) {
        if (err) return done(err);
        done(null, true);
      });
    }, minWait);
  });
};

module.exports = BucketClass;