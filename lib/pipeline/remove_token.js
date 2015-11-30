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

    var start = new Date();

    bucket_type.removeToken(message.key, message.count, function (err, result, bucket) {
      if (err) {
        return log.error({
          err:    err,
          method: 'TAKE',
          'type': message['type'],
          key:    message.key,
          count:  message.count,
        }, err.message);
      }

      log[err ? 'err' : 'info']({
        err:        err,
        method:     'TAKE',
        'type':     message['type'],
        key:        message.key,
        count:      message.count,
        conformant: result,
        remaining:  Math.floor(bucket.content),
        limit:      bucket.size,
        took:       new Date() - start
      }, 'TAKE');

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