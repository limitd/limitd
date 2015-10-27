var through = require('through');
var Response = require('../../messages').Response;
var StatusResponse = require('../../messages').StatusResponse;
var RequestMessage = require('../../messages').Request;

module.exports = function (buckets, log) {
  return through(function (message) {
    var stream = this;

    if (!(message instanceof RequestMessage)) {
      return stream.queue(message);
    }

    if (message.method !== RequestMessage.Method.STATUS) {
      return stream.queue(message);
    }

    var bucket_type = buckets.get(message['type']);

    log.debug({
      method:  'STATUS',
      type:    message.type,
      key:     message.key,
      query:   message.query
    }, 'query db');

    bucket_type.status(message.key, function (err, result) {
      log.debug({
        method:     'STATUS',
        'type':     message['type'],
        key:        message.key,
      }, 'status response');

      var response = new Response({
        request_id: message.id,
        type: Response.Type.STATUS
      });

      var statusResponse = new StatusResponse({
        items: result.map(function (r) {
          return {
            remaining: Math.floor(r.content),
            reset: r.reset,
            limit: r.size,
            instance: r.instance
          };
        })
      });

      response.set('.limitd.StatusResponse.response', statusResponse);

      stream.queue(response);
    });
  });
};