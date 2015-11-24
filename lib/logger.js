var bunyan = require('bunyan');

module.exports = function (log_level) {
  return bunyan.createLogger({
    name:  'limitd',
    level: log_level,
    serializers: {
      err: bunyan.stdSerializers.err
    }
  });
};