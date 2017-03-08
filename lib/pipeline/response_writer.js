var AvroResponse = require('../../messages/avro')['Response/Index'];

const Transform = require('stream').Transform;

module.exports = function (options) {
  var encode;

  if (options.protocol === 'protocol-buffers') {
    encode = (message) => {
      console.dir(message);
      return message.encode().toBuffer();
    };
  } else {
    encode = (message) => AvroResponse.toBuffer(message);
  }

  return Transform({
    objectMode: true,
    transform(message, enc, callback) {
      return callback(null, encode(message));
    }
  });
};
