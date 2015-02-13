var through = require('through');
var ResponseMessage = require('../../messages').Response;

module.exports = function () {
  return through(function (message) {
    if (!(message instanceof ResponseMessage)) {
      throw new Error('Unhandled request');
    }
    return this.queue(message.encodeDelimited().toBuffer());
  });
};