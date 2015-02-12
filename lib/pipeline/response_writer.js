var through = require('through');

module.exports = function () {
  return through(function (message) {
    return this.queue(message.encodeDelimited().toBuffer());
  });
};