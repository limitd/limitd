var Socket          = require('net').Socket;
var EventEmitter    = require('events').EventEmitter;
var util            = require('util');
var randomstring    = require('randomstring');

var RequestMessage  = require('./messages').Request;
var ResponseMessage  = require('./messages').Response;
var ResponseDecoder = require('./messages/decoders').ResponseDecoder;


function LimitdClient (options) {
  EventEmitter.call(this);
  this.socket = new Socket();
  this.socket.connect(options.port, options.address || options.host);

  var client = this;

  this.socket.once('connect', function () {
    client.emit('connect');
  }).pipe(ResponseDecoder()).on('data', function (response) {
    client.emit('response', response);
    client.emit('response_' + response.request_id, response);
  });
}

util.inherits(LimitdClient, EventEmitter);


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

  this.socket.write(request.encodeDelimited().toBuffer());
  this.once('response_' + request.id, function (response) {
    if (response.error === ResponseMessage.ErrorType.UNKNOWN_BUCKET_CLASS) {
      return done(new Error(clazz + ' is not a valid bucket class'));
    }
    done(null, response);
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