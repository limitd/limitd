var ZSchema = require('z-schema');
var ZSchemaErrors = require('z-schema-errors');
var configSchema = require('../conf/config.schema');

var validator = new ZSchema();

var intervalConflictMessage = 'limitd config validation error: Use only one ' +
  'of: per_second / per_minute / per_hour and/or size';

var reporter = ZSchemaErrors.init({
  contextMessage: 'limitd config validation error:',
  formats: {
    'ANY_OF_MISSING': intervalConflictMessage
  }
});

var validateMultipleIntervals = function (obj) {
  var intervals = Object.keys(obj).filter(function (e) {
    return e.indexOf('per_') === 0;
  });
  if (intervals.length > 1) {
    throw new Error(intervalConflictMessage);
  }
};

module.exports = function(config) {
  var isValid = validator.validate(config, configSchema);

  // use only one of: per_second / per_minute / per_hour
  if (isValid) {
    var type;
    for (type in config.buckets) {
      try {
        validateMultipleIntervals(config.buckets[type]);
        config.buckets[type].override && validateMultipleIntervals(config.buckets[type]);
      } catch (err) {
        return err.message;
      }
    }
  }
  if (isValid) return null;
  return reporter.extractMessage({ report: validator.lastReport });
};
