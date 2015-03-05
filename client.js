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

var DEFAULT_PORT = 9231;
var DEFAULT_HOST = 'localhost';

function LimitdClient (options) {
  options = options || {};
  EventEmitter.call(this);
  if (typeof options === 'string') {
    options = _.pick(url.parse(options), ['port', 'hostname']);
    options.port = parseInt(options.port || DEFAULT_PORT, 10);
  } else {
    options.port = options.port || DEFAULT_PORT;
    options.host = options.port || DEFAULT_HOST;
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

LimitdClient.prototype._request = function (method, type, key, count, done) {
  if (typeof count === 'function') {
    done = count;
    count = method == 'PUT' ? 'all' : 1;
  }

  if (typeof count === 'undefined') {
    count = method == 'PUT' ? 'all' : 1;
  }

  var request = new RequestMessage({
    'id':     randomstring.generate(7),
    'type':  type,
    'key':    key,
    'method': RequestMessage.Method[method],
  });

  if (count === 'all') {
    request.set('all', true);
  } else {
    request.set('count', count);
  }

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

  this.stream.write(request.encodeDelimited().toBuffer());

  if (!done) return;

  this.once('response_' + request.id, function (response) {
    if (response.type === ResponseMessage.Type.ERROR &&
        response['.limitd.ErrorResponse.response'].type === ErrorResponse.Type.UNKNOWN_BUCKET_TYPE) {
      return done(new Error(type + ' is not a valid bucket type'));
    }
    done(null, response['.limitd.TakeResponse.response'] || response['.limitd.PutResponse.response']);
  });
};

LimitdClient.prototype.take = function (type, key, count, done) {
  return this._request('TAKE', type, key, count, done);
};

LimitdClient.prototype.reset =
LimitdClient.prototype.put = function (type, key, count, done) {
  return this._request('PUT', type, key, count, done);
};

LimitdClient.prototype.wait = function (type, key, count, done) {
  return this._request('WAIT', type, key, count, done);
};

module.exports = LimitdClient;