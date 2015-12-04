var Response = require('../../messages').Response;
var TakeResponse = require('../../messages').TakeResponse;

module.exports.handle = function (buckets, log, message, done) {
  var bucket_type = buckets.get(message['type']);

  log.debug({
    method:  'WAIT',
    'type': message['type'],
    key:     message.key,
    count:   message.count
  }, 'waiting tokens');

  var since = Date.now();

  bucket_type.waitToken(message.key, message.count, function (err, delayed, bucket) {
    if (err) {
      return log.error({
        err:    err,
        method: 'TAKE',
        'type': message['type'],
        key:    message.key,
        count:  message.count,
      }, err.message);
    }

    log.info({
      method:     'WAIT',
      'type':     message['type'],
      key:        message.key,
      count:      message.count,
      delayed:    delayed,
      waited:     Date.now() - since,
      remaining:  Math.floor(bucket.content),
      limit:      bucket.size
    }, 'WAIT');

    var response = new Response({
      request_id: message.id,
      type: Response.Type.TAKE
    });

    var takeResponse = new TakeResponse({
      conformant: !err,
      delayed:    delayed,
      remaining:  Math.floor(bucket.content),
      reset:      bucket.reset,
      limit:      bucket.size
    });

    response.set('.limitd.TakeResponse.response', takeResponse);

    done(null, response);
  });
};