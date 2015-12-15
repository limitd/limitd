var Response = require('../../messages').Response;
var StatusResponse = require('../../messages').StatusResponse;

module.exports.handle = function (buckets, log, message, done) {
  var bucket_type = buckets.get(message['type']);

  log.debug({
    method:  'STATUS',
    type:    message.type,
    key:     message.key,
    query:   message.query
  }, 'query db');

  var start = new Date();

  bucket_type.status(message.key, function (err, result) {
    if (err) {
      log.error({
        method:     'STATUS',
        'type':     message['type'],
        key:        message.key,
        took:       new Date() - start,
        err: err
      });
    }

    log.info({
      method:     'STATUS',
      'type':     message['type'],
      key:        message.key,
      took:       new Date() - start
    }, 'STATUS');

    var response = new Response({
      request_id: message.id,
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

    done(null, response);
  });
};