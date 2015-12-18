var EventEmitter     = require('events').EventEmitter;
var util             = require('util');
var randomstring     = require('randomstring');
var reconnect        = require('reconnect-net');
var url              = require('url');
var _                = require('lodash');
var lps              = require('length-prefixed-stream');
var through2         = require('through2');

var DEFAULT_PORT = 9231;
var DEFAULT_HOST = 'localhost';

var PbRequestMessage   = require('./messages/protocol_buffers').Request;
var PbResponseMessage  = require('./messages/protocol_buffers').Response;

var AvroResponse = require('./messages/avro')['Response/Index'];
var AvroRequest = require('./messages/avro')['Request/Index'];

//This client is deprecate use:
//    npm install limitd-client --save

function LimitdClient (options, done) {
  options = options || {};
  EventEmitter.call(this);
  if (typeof options === 'string') {
    options = _.pick(url.parse(options), ['port', 'hostname']);
    options.port = parseInt(options.port || DEFAULT_PORT, 10);
  } else {
    options.port = options.port || DEFAULT_PORT;
    options.host = options.host || DEFAULT_HOST;
  }
  options.protocol = options.protocol || 'protocol-buffers';
  this._options = options;
  this.connect(done);
}

util.inherits(LimitdClient, EventEmitter);

LimitdClient.prototype._responseDecoder = function () {
  var protocol = this._options.protocol;
  return through2.obj(function (chunk, enc, callback) {
    var decoded;
    try {
      decoded = protocol === 'protocol-buffers' ?
                  PbResponseMessage.decode(chunk) :
                  AvroResponse.fromBuffer(chunk);
    } catch(err) {
      return callback(err);
    }

    callback(null, decoded);
  });
};

LimitdClient.prototype._requestEncoder = function () {
  var protocol = this._options.protocol;
  return through2.obj(function (request, enc, callback) {
    var buffer;
    if (protocol === 'protocol-buffers') {
      buffer = new PbRequestMessage(request).encode().toBuffer();
    } else {
      buffer = AvroRequest.toBuffer(request);
    }
    callback(null, buffer);
  });
};

LimitdClient.prototype.connect = function (done) {
  var options = this._options;
  var client = this;

  this.socket = reconnect(function (stream) {
    stream
      .pipe(lps.decode())
      .pipe(client._responseDecoder())
      .on('data', function (response) {
        client.emit('response', response);
        client.emit('response_' + response.request_id, response);
      });


    var encoder = client._requestEncoder();

    encoder
      .pipe(lps.encode())
      .pipe(stream);

    client.stream = encoder;

    client.emit('ready');
  }).once('connect', function () {
    client.emit('connect');
    if (done) {
      done();
    }
  }).on('close', function (has_error) {
    client.emit('close', has_error);
  }).on('error', function (err) {
    client.emit('error', err);
  }).connect(options.port, options.address || options.hostname || options.host);
};

LimitdClient.prototype._request = function (request, type, done) {
  var client = this;

  if (!this.stream || !this.stream.writable) {
    var err = new Error('The socket is closed.');
    if (done) {
      return process.nextTick(function () {
        done(err);
      });
    } else {
      throw err;
    }
  }

  this.stream.write(request);

  if (!done) return;

  this.once('response_' + request.id, function (response) {
    if (client._options.protocol === 'protocol-buffers') {
      if (response['.limitd.ErrorResponse.response'] &&
          response['.limitd.ErrorResponse.response'].type === 'UNKNOWN_BUCKET_TYPE') {
        return done(new Error(type + ' is not a valid bucket type'));
      }

      done(null, response['.limitd.TakeResponse.response']   ||
                 response['.limitd.PutResponse.response']    ||
                 response['.limitd.StatusResponse.response'] ||
                 response['.limitd.PongResponse.response']);
    } else {
      if (response.body &&
          response.body['limitd.ErrorBody'] &&
          response.body['limitd.ErrorBody'].code === 'UNKNOWN_BUCKET_TYPE') {
        return done(new Error(type + ' is not a valid bucket type'));
      }

      var body = _.values(response.body)[0];

      if (!body) { return done(); }

      var result = _.omit(body, [
                                  'bucket',
                                  '$clone',
                                  '$compare',
                                  '$getType',
                                  '$isValid',
                                  '$toBuffer',
                                  '$toString'
                                ]);

      result.items = _.reduce(body.items, function (r, v, k) {
        r.push(_.extend({ instance: k }, v));
        return r;
      }, []);

      if (body.bucket) {
        _.extend(result, body.bucket);
      }

      done(null, result);
    }
  });
};

LimitdClient.prototype._takeOrWait = function (method, type, key, count, done) {
  if (typeof count === 'function' || typeof done === 'undefined') {
    done = count;
    count = 1;
  }

  var request = {
    'id':     randomstring.generate(7),
    'type':   type,
    'key':    key,
    'method': method,
    'all':    count === 'all' ? true : undefined,
    'count':  count !== 'all' ? count : undefined
  };
  return this._request(request, type, done);
};

LimitdClient.prototype.take = function (type, key, count, done) {
  return this._takeOrWait('TAKE', type, key, count, done);
};

LimitdClient.prototype.wait = function (type, key, count, done) {
  return this._takeOrWait('WAIT', type, key, count, done);
};

LimitdClient.prototype.reset =
LimitdClient.prototype.put = function (type, key, count, done) {
  if (typeof count === 'function') {
    done = count;
    count = 'all';
  }

  var request = {
    'id':     randomstring.generate(7),
    'type':   type,
    'key':    key,
    'method': 'PUT',
    'all':    count === 'all',
    'count':  count !== 'all' ? count : undefined
  };

  return this._request(request, type, done);
};

LimitdClient.prototype.status = function (type, key, done) {
  var request = {
    'id':     randomstring.generate(7),
    'type':   type,
    'key':    key,
    'method': 'STATUS',
  };

  return this._request(request, type, done);
};

LimitdClient.prototype.ping = function (done) {
  var request = {
    'id':     randomstring.generate(7),
    'method': 'PING',
  };

  if (this._options.protocol === 'protocol-buffers') {
    request.type = '';
    request.key = '';
  }

  return this._request(request, '', done);
};

module.exports = LimitdClient;