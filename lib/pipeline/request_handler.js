var through2 = require('through2');
var handlers = require('../handlers');

function BuildProtocolBufferUnknonwnTypeError (protocol, message) {
  if (protocol === 'protocol-buffers') {
    var ResponseMessage = require('../../messages/protocol_buffers').Response;
    var ErrorResponse   = require('../../messages/protocol_buffers').ErrorResponse;

    var response = new ResponseMessage({
      request_id: message.id
    });

    var errorResponse = new ErrorResponse({
      type: ErrorResponse.Type.UNKNOWN_BUCKET_TYPE,
    });

    response.set('.limitd.ErrorResponse.response', errorResponse);

    return response;
  } else {
    return {
      request_id: message.id,
      body: {
        'limitd.ErrorBody': {
          code: 'UNKNOWN_BUCKET_TYPE'
        }
      }
    };
  }
}


module.exports = function (options, buckets, log) {
  return through2.obj(function (message, enc, callback) {
    if (message.method !== 'PING') {
      var bucket_type = buckets.get(message['type']);

      if (!bucket_type) {
        return callback(null, BuildProtocolBufferUnknonwnTypeError(options.protocol, message));
      }
    }
    handlers.get(message.method).handle(buckets, log, options.protocol, message, function (err, result) {
      return callback(null, result);
    });
  });
};