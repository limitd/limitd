var through = require('through');
var ResponseMessage = require('../../messages').Response;

module.exports = function (buckets) {
  return through(function (message) {
    var stream = this;

    if (message instanceof ResponseMessage) {
      return stream.queue(message);
    }

    var bucket_class = buckets.get(message['class']);
    bucket_class.removeToken(message.key, message.count, function (err, result) {
      stream.queue(new ResponseMessage({
        request_id: message.id,
        conformant: !err && result,
      }));
    });
  });
};