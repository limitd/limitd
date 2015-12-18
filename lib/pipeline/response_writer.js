var AvroResponse = require('../../messages/avro')['Response/Index'];

var through2 = require('through2');

module.exports = function (options) {
  return through2.obj(function (message, enc, callback) {
    var buffer;

    if (options.protocol === 'protocol-buffers') {
      buffer = message.encode().toBuffer();
    } else {
      buffer = AvroResponse.toBuffer(message);
    }

    return callback(null, buffer);
  });
};