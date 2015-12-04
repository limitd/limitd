var through = require('through');
var RequestMessage = require('../../messages').Request;
var handlers = require('../handlers');

module.exports = function (buckets, log) {
  return through(function (message) {
    var stream = this;

    if (!(message instanceof RequestMessage)) {
      return stream.queue(message);
    }

    handlers.get(message.method).handle(buckets, log, message, function (err, result) {
      stream.queue(result);
    });
  });
};