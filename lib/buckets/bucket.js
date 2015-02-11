function BucketClass (db, options) {
  this._db = db;
  this._options = options;
}

/**
 * add the delta of tokens to the bucket.
 * copied from https://github.com/jhurliman/node-rate-limiter
 */
BucketClass.prototype._drip = function (bucket) {
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
      return done(null, false);
    }

    bucket.content -= count;

    self._db.put(instance, bucket, {
      ttl: self._options.interval * 1.5
    }, function (err) {
      release();
      if (err) return done(err);
      done(null, true);
    });
  });
};

module.exports = BucketClass;