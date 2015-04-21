var messages = require('./.');
var through    = require('through');
var ByteBuffer = require('protobufjs').ByteBuffer;
var decoder = require('pb-stream').decoder;

function buildDecoder(Message) {
  return decoder(Message);
}

Object.keys(messages).forEach(function (k) {
  module.exports[k + 'Decoder'] = function () {
    return buildDecoder(messages[k]);
  };
});