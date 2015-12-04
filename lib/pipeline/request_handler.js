var through2 = require('through2');
var RequestMessage = require('../../messages').Request;
var handlers = require('../handlers');

module.exports = function (buckets, log) {
  return through2.obj(function (message, enc, callback) {
    if (!(message instanceof RequestMessage)) {
      return callback(null, message);
    }

    handlers.get(message.method).handle(buckets, log, message, function (err, result) {
      return callback(null, result);
    });
  });
};