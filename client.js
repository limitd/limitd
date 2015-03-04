var EventEmitter     = require('events').EventEmitter;
var util             = require('util');
var randomstring     = require('randomstring');
var reconnect        = require('reconnect-net');
var RequestMessage   = require('./messages').Request;
var ResponseMessage  = require('./messages').Response;
var ErrorResponse  = require('./messages').ErrorResponse;
var ResponseDecoder  = require('./messages/decoders').ResponseDecoder;
var url              = require('url');
var _                = require('lodash');

function LimitdClient (options) {
  EventEmitter.call(this);
  if (typeof options === 'string') {
    options = _.pick(url.parse(options), ['port', 'hostname']);
    options.port = parseInt(options.port || 9231, 10);
  }
  this._options = options;
  this.connect();
}

util.inherits(LimitdClient, EventEmitter);

LimitdClient.prototype.connect = function (done) {
  var options = this._options;
  var client = this;

  this.socket = reconnect(function (stream) {

    stream.pipe(ResponseDecoder()).on('data', function (response) {
      client.emit('response', response);
      client.emit('response_' + response.request_id, response);
    });

    client.stream = stream;
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

LimitdClient.prototype._request = function (method, clazz, key, count, done) {
  if (typeof count === 'function') {
    done = count;
    count = 1;
  }
  if (!done) {
    done = function(){};
  }
  var request = new RequestMessage({
    'id':     randomstring.generate(7),
    'class':  clazz,
    'key':    key,
    'method': RequestMessage.Method[method],
    'count':  count
  });

  if (!this.stream || !this.stream.writable) {
    return process.nextTick(function () {
      done(new Error('The socket is closed.'));
    });
  }

  this.stream.write(request.encodeDelimited().toBuffer());
  this.once('response_' + request.id, function (response) {
    if (response.type === ResponseMessage.Type.Error &&
        response['.limitd.ErrorResponse.response'].type === ErrorResponse.Type.UNKNOWN_BUCKET_CLASS) {
      return done(new Error(clazz + ' is not a valid bucket class'));
    }
    done(null, response['.limitd.TakeResponse.response']);
  });
};

LimitdClient.prototype.take = function (clazz, key, count, done) {
  return this._request('TAKE', clazz, key, count, done);
};

LimitdClient.prototype.put = function (clazz, key, count, done) {
  return this._request('PUT', clazz, key, count, done);
};

LimitdClient.prototype.wait = function (clazz, key, count, done) {
  return this._request('WAIT', clazz, key, count, done);
};

module.exports = LimitdClient;