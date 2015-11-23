var through = require('through');
var Response = require('../../messages').Response;
var PutResponse = require('../../messages').PutResponse;
var RequestMessage = require('../../messages').Request;

module.exports = function (buckets, log) {
  return through(function (message) {
    var stream = this;

    if (!(message instanceof RequestMessage)) {
      return stream.queue(message);
    }

    if (message.method !== RequestMessage.Method.PUT) {
      return stream.queue(message);
    }

    var bucket_type = buckets.get(message['type']);

    log.debug({
      method:  'PUT',
      'type': message['type'],
      key:     message.key,
      count:   message.count
    }, 'adding tokens');

    var start = new Date();

    bucket_type.putToken(message.key, message.all || message.count, function (err, bucket) {
      log.info({
        method:     'PUT',
        'type':     message['type'],
        key:        message.key,
        count:      message.count,
        all:        message.all,
        remaining:  Math.floor(bucket.content),
        limit:      bucket.size,
        took:       new Date() - start
      }, 'PUT/RESET');

      var response = new Response({
        request_id: message.id,
        type: Response.Type.PUT
      });

      var putResponse = new PutResponse({
        remaining: Math.floor(bucket.content),
        reset: bucket.reset,
        limit: bucket.size
      });

      response.set('.limitd.PutResponse.response', putResponse);

      stream.queue(response);
    });
  });
};