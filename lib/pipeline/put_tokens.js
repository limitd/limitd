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

    var bucket_class = buckets.get(message['class']);

    log.debug({
      method:  'PUT',
      'class': message['class'],
      key:     message.key,
      count:   message.count
    }, 'taking tokens');

    bucket_class.putToken(message.key, message.all || message.count, function (err, bucket) {
      log.debug({
        method:     'PUT',
        'class':    message['class'],
        key:        message.key,
        count:      message.count,
        all:        message.all,
      }, 'tokens added');

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