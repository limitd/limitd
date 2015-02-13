var through = require('through');
var ResponseMessage = require('../../messages').Response;
var RequestMessage = require('../../messages').Request;

module.exports = function (buckets, log) {
  return through(function (message) {
    var stream = this;

    if (!(message instanceof RequestMessage)) {
      return stream.queue(message);
    }

    if (message.method !== RequestMessage.Method.WAIT) {
      return stream.queue(message);
    }

    var bucket_class = buckets.get(message['class']);

    log.debug({
      method:  'WAIT',
      'class': message['class'],
      key:     message.key,
      count:   message.count
    }, 'waiting tokens');

    var since = Date.now();

    bucket_class.waitToken(message.key, message.count, function (err, delayed) {

      log.debug({
        method:  'WAIT',
        'class': message['class'],
        key:     message.key,
        count:   message.count,
        delayed: delayed,
        waited:  Date.now() - since
      }, 'tokens ready');

      stream.queue(new ResponseMessage({
        request_id: message.id,
        conformant: !err,
        delayed:    delayed
      }));
    });
  });
};