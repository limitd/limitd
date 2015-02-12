var through = require('through');
var ResponseMessage = require('../../messages').Response;

module.exports = function (buckets) {
  return through(function (message) {
    var bucket_class = buckets.get(message['class']);
    if (bucket_class) {
      return this.queue(message);
    }

    var response = new ResponseMessage({
      request_id: message.id,
      conformant: false,
      error: ResponseMessage.ErrorType.UNKNOWN_BUCKET_CLASS
    });

    return this.queue(response);
  });
};