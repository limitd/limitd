var leveldb = require('./leveldb');
var redis = require('./redis');

module.exports = function (options) {
  if (typeof options === 'string') {
    options = {
      backend: 'leveldb',
      path: options
    };
  }

  if (options.backend === 'leveldb') {
    return leveldb(options.path);
  } else if (options.backend === 'redis') {
    return redis(options);
  }
};