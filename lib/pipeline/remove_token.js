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

    var bucket_class = buckets.get(message['class']);

    log.debug({
      method:  'TAKE',
      'class': message['class'],
      key:     message.key,
      count:   message.count
    }, 'taking tokens');

    bucket_class.removeToken(message.key, message.count, function (err, result) {

      log.debug({
        method:     'TAKE',
        'class':    message['class'],
        key:        message.key,
        count:      message.count,
        conformant: result
      }, 'tokens taked');

      var response = new Response({
        request_id: message.id,
        type: Response.Type.Take
      });

      var takeResponse = new TakeResponse({
        conformant: !err && result,
        remaining: 0,
        reset: 0
      });

      response.set('.limitd.TakeResponse.response', takeResponse);

      stream.queue(response);
    });
  });
};