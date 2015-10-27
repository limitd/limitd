var ResponseMessage = require('../../messages').Response;
var encoder = require('pb-stream').encoder;

module.exports = function () {
  return encoder(ResponseMessage);
};