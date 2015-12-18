var Response = require('../../messages/protocol_buffers').Response;
var TakeResponse = require('../../messages/protocol_buffers').TakeResponse;

function build_take_response (protocol, message, conformant, bucket) {
  if (protocol === 'protocol-buffers') {
    var response = new Response({
      request_id: message.id,
    });

    var takeResponse = new TakeResponse({
      conformant: conformant,
      remaining: Math.floor(bucket.content),
      reset: bucket.reset,
      limit: bucket.size
    });

    response.set('.limitd.TakeResponse.response', takeResponse);
    return response;
  } else {
    return {
      request_id: message.id,
      body: {
        'limitd.TakeBody': {
          conformant: conformant,
          bucket: {
            remaining: Math.floor(bucket.content),
            reset: bucket.reset,
            limit: bucket.size
          }
        }
      },
    };
  }
}

module.exports.handle = function (buckets, log, protocol, message, done) {
  var bucket_type = buckets.get(message['type']);

  log.debug({
    method:  'TAKE',
    'type': message['type'],
    key:     message.key,
    count:   message.count
  }, 'taking tokens');

  var start = new Date();

  bucket_type.removeToken(message.key, message.count, function (err, conformant, bucket) {
    if (err) {
      return log.error({
        err:    err,
        method: 'TAKE',
        'type': message['type'],
        key:    message.key,
        count:  message.count,
      }, err.message);
    }

    log[err ? 'err' : 'info']({
      err:        err,
      method:     'TAKE',
      'type':     message['type'],
      key:        message.key,
      count:      message.count,
      conformant: conformant,
      remaining:  Math.floor(bucket.content),
      limit:      bucket.size,
      took:       new Date() - start
    }, 'TAKE');

    done(null, build_take_response(protocol, message, conformant, bucket));
  });
};