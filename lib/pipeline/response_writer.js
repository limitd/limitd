var ResponseMessage = require('../../messages').Response;

var through2 = require('through2');

module.exports = function () {
  return through2.obj(function (message, enc, callback) {

    if (!(message instanceof ResponseMessage)) {
      throw new Error('Unhandled request');
    }

    return callback(null, message.encodeDelimited().toBuffer());
  });
};