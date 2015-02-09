var messages = require('./.');
var through    = require('through');
var ByteBuffer = require('protobufjs').ByteBuffer;

function buildDecoder(Message) {
  var buffer;

  return through(function (chunk) {
    chunk = ByteBuffer.wrap(chunk);
    buffer = buffer ? ByteBuffer.concat([buffer, chunk]) : chunk;

    var decoded;

    while (buffer.remaining() > 0) {

      try {
        decoded = Message.decodeDelimited(buffer);
      } catch (err) {
        return this.queue({ error: 'unknown message' });
      }

      if (!decoded) break;

      buffer.compact();
      this.queue(decoded);
    }
  });
}

Object.keys(messages).forEach(function (k) {
  module.exports[k + 'Decoder'] = buildDecoder(messages[k]);
});