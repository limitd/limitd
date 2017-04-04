var Response = require('../../messages/protocol_buffers').Response;
var PongResponse = require('../../messages/protocol_buffers').PongResponse;
var agent = require('auth0-instrumentation');
var tags = { method: 'PING' };

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
  agent.metrics.increment('requests.incoming', 1, tags);

  log.info({
    method:     'PING',
    'type':     message['type'],
    key:        message.key,
    count:      message.count,
    all:        message.all,
  }, 'PING');

  var start = new Date();
  var result = build_pong_response(protocol, message);
  agent.metrics.increment('requests.processed', 1, tags);
  agent.metrics.histogram('response.time', (new Date() - start), tags);
  setImmediate(done, null, result);
};