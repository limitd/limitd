var server = module.exports;

var net = require('net');
var _ = require('lodash');

var Buckets = require('./lib/buckets');
var log = require('./lib/log');

var RequestDecoder = require('./messages/decoders').RequestDecoder;
var ResponseMessage = require('./messages').Response;
var server_config = require('./lib/server_config');
var db = require('./lib/db');

function connection_handler (socket) {
  log.debug(_.pick(socket, ['remoteAddress', 'remotePort']), 'connection accepted');
  socket.pipe(RequestDecoder).on('data', function (m) {
    if (m.error) {
      log.debug(_.pick(socket, ['remoteAddress', 'remotePort']), 'unknown message format');
      return socket.end();
    }
    var bucket_class = server._buckets.get(m['class']);
    if (!bucket_class) {
      return socket.write(new ResponseMessage({
        request_id: m.id,
        conformant: false,
        error: ResponseMessage.ErrorType.UNKNOWN_BUCKET_CLASS
      }).encodeDelimited().toBuffer());
    }
    bucket_class.removeToken(m.key, m.count, function (err, result) {
      socket.write(new ResponseMessage({
        request_id: m.id,
        conformant: !err && result,
      }).encodeDelimited().toBuffer());
    });
  });
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