var through2 = require('through2');
var ResponseMessage = require('../../messages').Response;
var RequestMessage = require('../../messages').Request;
var ErrorResponse = require('../../messages').ErrorResponse;

module.exports = function (buckets) {
  return through2.obj(function (message, enc, callback) {
    if (message.method === RequestMessage.Method.PING) {
      return callback(null, message);
    }

    var bucket_type = buckets.get(message['type']);
    if (bucket_type) {
      return callback(null, message);
    }

    var response = new ResponseMessage({
      request_id: message.id
    });

    var errorResponse = new ErrorResponse({
      type: ErrorResponse.Type.UNKNOWN_BUCKET_TYPE,
    });

    response.set('.limitd.ErrorResponse.response', errorResponse);
    return callback(null, response);
  });
};