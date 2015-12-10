var messages = require('./.');
var through2 = require('through2');

function buildDecoder(Message) {
  return through2.obj(function (chunk, enc, callback) {
    var decoded;
    try {
      decoded = Message.decode(chunk);
      callback(null, decoded);
    } catch(err) {
      callback(err);
    }
  });
}

Object.keys(messages).forEach(function (k) {
  module.exports[k + 'Decoder'] = function () {
    return buildDecoder(messages[k]);
  };
});