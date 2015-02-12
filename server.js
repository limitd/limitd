var server = module.exports;

var net = require('net');
var _ = require('lodash');

var Buckets = require('./lib/buckets');
var log = require('./lib/log');

var RequestDecoder = require('./messages/decoders').RequestDecoder;
var server_config = require('./lib/server_config');
var db = require('./lib/db');

var ClassValidator = require('./lib/pipeline/class_validator');
var TokenExtractor = require('./lib/pipeline/token_extractor');
var ResponseWriter = require('./lib/pipeline/response_writer');

function connection_handler (socket) {
  var sockets_details = _.pick(socket, ['remoteAddress', 'remotePort']);

  log.debug(sockets_details, 'connection accepted');

  var decoder = RequestDecoder();

  decoder.on('error', function () {
    log.debug(sockets_details, 'unknown message format');
    return socket.end();
  });

  socket.pipe(decoder)
        .pipe(ClassValidator(server._buckets))
        .pipe(TokenExtractor(server._buckets))
        .pipe(ResponseWriter())
        .pipe(socket);
}

server.start = function (options, callback) {
  var self = this;
  var config = server_config.get(options);

  self._db = db.get(config);
  self._buckets = new Buckets(self._db, config);

  self._server = net.createServer(connection_handler);
  self._server.listen(config.PORT, function(err) {
    if (err) {
      console.error("Initialization error\n", err.stack);
      if (module.parent) {
        if (callback) return callback(err);
      } else {
        return process.exit(1);
      }
    }

    log.debug({port: config.PORT}, 'server started');

    if (callback) {
      callback(null, self._server.address());
    }
  });
};

server.stop = function (callback) {
  this._server.close(callback);
};

if (!module.parent) {
  server.start();
  process.on('SIGTERM', stop);
}