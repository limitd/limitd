var through = require('through');
var Response = require('../../messages').Response;
var TakeResponse = require('../../messages').TakeResponse;
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

    bucket_class.waitToken(message.key, message.count, function (err, delayed, bucket) {

      log.debug({
        method:  'WAIT',
        'class': message['class'],
        key:     message.key,
        count:   message.count,
        delayed: delayed,
        waited:  Date.now() - since
      }, 'tokens ready');

      var response = new Response({
        request_id: message.id,
        type: Response.Type.Take
      });

      var takeResponse = new TakeResponse({
        conformant: !err,
        delayed:    delayed,
        remaining:  Math.floor(bucket.content),
        reset:      bucket.reset,
        limit:      bucket.size
      });

      response.set('.limitd.TakeResponse.response', takeResponse);

      stream.queue(response);
    });
  });
};