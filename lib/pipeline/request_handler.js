const Transform = require('stream').Transform;

// const through2 = require('through2');
// const handlers = require('../handlers');
const Ping = require('../handlers/ping');

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


module.exports = function (params) {
  const ping = Ping(params.buckets, params.logger, params.protocol);

  return Transform({
    objectMode: true,
    transform(message, enc, callback) {
      if (message.method !== 'PING') {
        console.log('message.method', message.method);
        const bucket_type = params.buckets.get(message['type']);

        if (!bucket_type) {
          params.write(BuildProtocolBufferUnknonwnTypeError(params.protocol, message));
          return callback();
        }
      }

      ping(message, function (err, result) {
        params.write(result);
      });

      callback();
    }
  });
};
