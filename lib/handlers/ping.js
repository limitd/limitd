var Response = require('../../messages').Response;
var PongResponse = require('../../messages').PongResponse;

module.exports.handle = function (buckets, log, message, done) {
  log.info({
    method:     'PING',
    'type':     message['type'],
    key:        message.key,
    count:      message.count,
    all:        message.all,
  }, 'PING');

  var response = new Response({});

  response.set('request_id', message.id, true);
  response.set('type', Response.Type.PONG, true);

  var pongResponse = new PongResponse({});

  response.set('.limitd.PongResponse.response', pongResponse, true);

  setImmediate(done, null, response);
};