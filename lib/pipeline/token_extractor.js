var through = require('through');
var ResponseMessage = require('../../messages').Response;
var RequestMessage = require('../../messages').Request;

module.exports = function (buckets) {
  return through(function (message) {
    var stream = this;

    if (message instanceof ResponseMessage) {
      return stream.queue(message);
    }

    var bucket_class = buckets.get(message['class']);
    var method;

    switch (message.method) {
      case RequestMessage.Method.TAKE:
        method = 'removeToken';
        break;
      case RequestMessage.Method.WAIT:
        method = 'waitToken';
        break;
      default:
        throw new Error('not implemented');
    }

    bucket_class[method](message.key, message.count, function (err, result) {
      stream.queue(new ResponseMessage({
        request_id: message.id,
        conformant: !err && result,
      }));
    });
  });
};