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

    var bucket_type = buckets.get(message['type']);

    log.debug({
      method:  'WAIT',
      'type': message['type'],
      key:     message.key,
      count:   message.count
    }, 'waiting tokens');

    var since = Date.now();

    bucket_type.waitToken(message.key, message.count, function (err, delayed, bucket) {

      log.debug({
        method:  'WAIT',
        'type': message['type'],
        key:     message.key,
        count:   message.count,
        delayed: delayed,
        waited:  Date.now() - since,
        remaining:  Math.floor(bucket.content),
        limit:      bucket.size
      }, 'tokens ready');

      var response = new Response({
        request_id: message.id,
        type: Response.Type.TAKE
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