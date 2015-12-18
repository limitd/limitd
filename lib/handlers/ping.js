var Response = require('../../messages/protocol_buffers').Response;
var PongResponse = require('../../messages/protocol_buffers').PongResponse;

function build_pong_response (protocol, message) {
  if (protocol === 'protocol-buffers') {
    var response = new Response({});
    response.set('request_id', message.id, true);
    var pongResponse = new PongResponse({});
    response.set('.limitd.PongResponse.response', pongResponse, true);
    return response;
  } else {
    return {
      request_id: message.id
    };
  }
}

module.exports.handle = function (buckets, log, protocol, message, done) {
  log.info({
    method:     'PING',
    'type':     message['type'],
    key:        message.key,
    count:      message.count,
    all:        message.all,
  }, 'PING');


  setImmediate(done, null, build_pong_response(protocol, message));
};