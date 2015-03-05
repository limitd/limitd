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

    if (message.method !== RequestMessage.Method.TAKE) {
      return stream.queue(message);
    }

    var bucket_type = buckets.get(message['type']);

    log.debug({
      method:  'TAKE',
      'type': message['type'],
      key:     message.key,
      count:   message.count
    }, 'taking tokens');

    bucket_type.removeToken(message.key, message.count, function (err, result, bucket) {

      log.debug({
        method:     'TAKE',
        'type':    message['type'],
        key:        message.key,
        count:      message.count,
        conformant: result
      }, 'tokens taked');

      var response = new Response({
        request_id: message.id,
        type: Response.Type.TAKE
      });

      var takeResponse = new TakeResponse({
        conformant: !err && result,
        remaining: Math.floor(bucket.content),
        reset: bucket.reset,
        limit: bucket.size
      });

      response.set('.limitd.TakeResponse.response', takeResponse);

      stream.queue(response);
    });
  });
};