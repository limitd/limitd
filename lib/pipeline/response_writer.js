var ResponseMessage = require('../../messages').Response;
// var encoder = require('pb-stream').encoder;

// module.exports = function () {


//   return encoder(ResponseMessage);
// };
//
//

var through2 = require('through2');

module.exports = function () {
  return through2.obj(function (message, enc, callback) {

    if (!(message instanceof ResponseMessage)) {
      // if (options.ignore_invalid) {
      //   return this.queue(message);
      // }
      throw new Error('Unhandled request');
    }

    return callback(null, message.encodeDelimited(null, true).toBuffer());
  });
};