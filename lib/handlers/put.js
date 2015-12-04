var Response = require('../../messages').Response;
var PutResponse = require('../../messages').PutResponse;

module.exports.handle = function (buckets, log, message, done) {
  var bucket_type = buckets.get(message['type']);

  log.debug({
    method:  'PUT',
    'type': message['type'],
    key:     message.key,
    count:   message.count
  }, 'adding tokens');

  var start = new Date();

  bucket_type.putToken(message.key, message.all || message.count, function (err, bucket) {
    if (err) {
      return log.error({
        err:    err,
        method: 'PUT',
        'type': message['type'],
        key:    message.key,
        count:  message.count,
        all:    message.all,
      }, err.message);
    }

    log.info({
      err:        err,
      method:     'PUT',
      'type':     message['type'],
      key:        message.key,
      count:      message.count,
      all:        message.all,
      remaining:  Math.floor(bucket.content),
      limit:      bucket.size,
      took:       new Date() - start
    }, 'PUT/RESET');

    var response = new Response({
      request_id: message.id,
      type: Response.Type.PUT
    });

    var putResponse = new PutResponse({
      remaining: Math.floor(bucket.content),
      reset: bucket.reset,
      limit: bucket.size
    });

    response.set('.limitd.PutResponse.response', putResponse);

    done(null, response);
  });
};