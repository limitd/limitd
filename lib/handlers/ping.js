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

  var response = new Response({
    request_id: message.id,
    type: Response.Type.PONG
  });

  var pongResponse = new PongResponse({});

  response.set('.limitd.PongResponse.response', pongResponse);

  setImmediate(done, null, response);
};