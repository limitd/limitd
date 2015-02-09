var BucketClass = require('./bucket');

function Buckets (db, config) {
  this._db = db;
  this._config = config;
  this._buckets = {};

  var self = this;

  Object.keys(config.BUCKETS)
        .forEach(function (key) {
          var bucket_config = config.BUCKETS[key];
          var db = self._db.buildSpace(key);
          self._buckets[key] = new BucketClass(db, bucket_config);
        });
}

Buckets.prototype.get = function (name) {
  return this._buckets[name];
};

module.exports = Buckets;