var through = require('through');
var ResponseMessage = require('../../messages').Response;
var RequestMessage = require('../../messages').Request;
var ErrorResponse = require('../../messages').ErrorResponse;

module.exports = function (buckets) {
  return through(function (message) {
    if (message.method === RequestMessage.Method.PING) {
      return this.queue(message);
    }

    var bucket_type = buckets.get(message['type']);
    if (bucket_type) {
      return this.queue(message);
    }

    var response = new ResponseMessage({
      request_id: message.id,
      type: ResponseMessage.Type.ERROR
    });

    var errorResponse = new ErrorResponse({
      type: ErrorResponse.Type.UNKNOWN_BUCKET_TYPE,
    });

    response.set('.limitd.ErrorResponse.response', errorResponse);

    return this.queue(response);
  });
};