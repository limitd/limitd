var Bucket = require('./bucket');
var _      = require('lodash');
var ms     = require('ms');

var INTERVAL_TO_MS = {
  'per_second': ms('1s'),
  'per_minute': ms('1m'),
  'per_hour':   ms('1h'),
  'per_day':    ms('1d'),
};

function normalize_time(config) {
  var result = {};

  Object.keys(config)
    .forEach(function (k) {
      if (~['per_second', 'per_minute', 'per_hour', 'per_day', 'per_month'].indexOf(k)) {
        result.interval = INTERVAL_TO_MS[k];
        result.per_interval = config[k];
      } else if (k === 'override') {
        result[k] = _.mapValues(config[k], normalize_time);
      } else {
        result[k] = config[k];
      }
    });

  if (typeof result.size === 'undefined') {
    result.size = result.per_interval;
  }

  return result;
}

function Buckets (db, config) {
  this._db = db;
  this._config = config;
  this._buckets = {};

  var self = this;

  Object.keys(config.buckets)
        .forEach(function (key) {
          var bucket_config = normalize_time(config.buckets[key]);
          var db = self._db.create(key);
          self._buckets[key] = new Bucket(db, bucket_config);
        });
}

Buckets.prototype.get = function (name) {
  return this._buckets[name];
};

module.exports = Buckets;