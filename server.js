var EventEmitter = require('events').EventEmitter;

var util   = require('util');
var logger = require('./lib/logger');
var _      = require('lodash');
var net = require('net');
var Buckets = require('./lib/buckets');

var RequestDecoder = require('./messages/decoders').RequestDecoder;

var ClassValidator = require('./lib/pipeline/class_validator');
var ResponseWriter = require('./lib/pipeline/response_writer');
var RemoveToken = require('./lib/pipeline/remove_token');
var WaitToken = require('./lib/pipeline/wait_token');

var db = require('./lib/db');

var defaults = {
  port:      9231,
  hostname:  '0.0.0.0',
  log_level: 'info'
};

/*
 * Creates an instance of LimitdServer.
 *
 * Options:
 *
 *  - `db` the path to the database. Required.
 *  - `port` the port to listen to. Defaults to 9231.
 *  - `hostname` the hostname to bind to. Defaults to INADDR_ANY
 *  - `log_level` the verbosity of the logs. Defaults to 'info'.
 *
 */
function LimitdServer (options) {
  EventEmitter.call(this);
  var self = this;


  if (!options.db) {
    throw new TypeError('"db" is required');
  }

  this._config = _.extend({}, defaults, options);
  this._logger = logger(this._config.log_level);
  this._server = net.createServer(this._handler.bind(this));

  this._server.on('error', function (err) {
    self.emit('error', err);
  });

  this._db = db(this._config.db);
  this._buckets = new Buckets(this._db, this._config);
}

util.inherits(LimitdServer, EventEmitter);


LimitdServer.prototype._handler = function (socket) {
  var sockets_details = _.pick(socket, ['remoteAddress', 'remotePort']);
  var log = this._logger;

  log.debug(sockets_details, 'connection accepted');

  var decoder = RequestDecoder();

  decoder.on('error', function () {
    log.debug(sockets_details, 'unknown message format');
    return socket.end();
  });

  socket.pipe(decoder)
        .pipe(ClassValidator(this._buckets))
        .pipe(RemoveToken(this._buckets, log))
        .pipe(WaitToken(this._buckets, log))
        .pipe(ResponseWriter())
        .pipe(socket);
};

LimitdServer.prototype.start = function (done) {
  var self = this;
  var log = self._logger;

  self._server.listen(this._config.port, this._config.hostname, function(err) {
    if (err) {
      log.error(err, 'error starting server');
      self.emit('error', err);
      if (done) {
        done(err);
      }
      return;
    }

    var address = self._server.address();
    log.debug(address, 'server started');
    self.emit('started', address);
    if (done) {
      done(null, address);
    }
  });

  return this;
};


LimitdServer.prototype.close = function () {
  var self = this;
  var log = self._logger;
  var address = self._server.address();

  this._server.close(function() {
    log.debug(address, 'server closed');
    self.emit('close');
  });
};


module.exports = LimitdServer;

