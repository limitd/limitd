var through2 = require('through2');
var ProtocolBufferRequest = require('../../messages/protocol_buffers').Request;
var AvroRequest = require('../../messages/avro')['Request/Index'];

module.exports = function (options) {
  return through2.obj(function (chunk, enc, callback) {
    var decoded;

    try {
      decoded = options.protocol === 'protocol-buffers' ?
                ProtocolBufferRequest.decode(chunk) :
                AvroRequest.fromBuffer(chunk);
    } catch(err) {
      return callback(err);
    }

    callback(null, decoded);
  });
};