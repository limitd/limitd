var through = require('through');
var ResponseMessage = require('../../messages').Response;
var RequestMessage = require('../../messages').Request;

module.exports = function (buckets, log) {
  return through(function (message) {
    var stream = this;

    if (!(message instanceof RequestMessage)) {
      return stream.queue(message);
    }

    if (message.method !== RequestMessage.Method.TAKE) {
      return stream.queue(message);
    }

    var bucket_class = buckets.get(message['class']);

    log.debug({
      method: 'TAKE',
      'class': message['class'],
      key: message.key,
      count: message.count
    }, 'taking tokens');

    bucket_class.removeToken(message.key, message.count, function (err, result) {

      log.debug({
        method:     'TAKE',
        'class':    message['class'],
        key:        message.key,
        count:      message.count,
        conformant: result
      }, 'tokens taked');

      stream.queue(new ResponseMessage({
        request_id: message.id,
        conformant: !err && result,
      }));
    });
  });
};