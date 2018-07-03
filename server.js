const EventEmitter = require('events').EventEmitter;

const util    = require('util');
const cb = require('cb');
const _       = require('lodash');
const net     = require('net');
const LimitDB = require('limitdb');
const agent   = require('./lib/agent');
const logger  = agent.logger;
const RequestHandler  = require('./lib/pipeline/RequestHandler');
const RequestDecoder  = require('./lib/pipeline/RequestDecoder');
const ResponseEncoder = require('./lib/pipeline/ResponseEncoder');

const lps = require('length-prefixed-stream');

const validateConfig = require('./lib/config_validator');

const enableDestroy = require('server-destroy');

const defaults = {
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
  var configError = validateConfig(this._config);
  if (configError) {
    throw new Error(configError);
  }

  this._server = net.createServer(this._handler.bind(this));
  enableDestroy(this._server);

  this._server.on('error', function (err) {
    self.emit('error', err);
  });

  var dbConfig = { types: this._config.buckets };

  if (typeof this._config.db === 'string') {
    dbConfig.path = this._config.db;
  } else if(typeof this._config.db === 'object') {
    Object.assign(dbConfig, this._config.db);
  }

  this._db = new LimitDB(dbConfig);

  this._db
    .on('ready', () => logger.info({ path: dbConfig.path }, 'Database ready.'))
    .on('error', err => this.emit('error', err))
    .on('repairing', () => {
      logger.info({ path: dbConfig.path }, 'Repairing database.');
    });
}

util.inherits(LimitdServer, EventEmitter);

LimitdServer.prototype._handler = function (socket) {
  socket.setNoDelay();
  socket.setKeepAlive(true);

  const sockets_details = {
    remoteAddress: socket.remoteAddress,
    remotePort: socket.remotePort
  };

  socket.on('error', function (err) {
    logger.info(_.extend(sockets_details, {
      err: {
        code:    err.code,
        message: err.message
      }
    }), 'connection error');
  }).on('close', function () {
    logger.info(sockets_details, 'connection closed');
  });

  logger.debug(sockets_details, 'connection accepted');

  const decoder = new RequestDecoder();

  decoder.on('error', function (err) {
    logger.error(_.extend(sockets_details, { err }), 'Error detected in the request pipeline.');
    return socket.end();
  });

  const request_handler = new RequestHandler({
    db: this._db,
  });

  request_handler.once('error', (err) => {
    const critical = err.message.indexOf('undefined bucket type') === -1;
    logger[critical ? 'error' : 'info'](_.extend(sockets_details, { err }), 'Error detected in the request pipeline.');
    if (critical) { socket.end(); }
  });

  const encoder = new ResponseEncoder();

  socket.pipe(lps.decode())
        .pipe(decoder)
        .pipe(request_handler)
        .pipe(encoder)
        .pipe(lps.encode())
        .pipe(socket);
};

LimitdServer.prototype.start = function (done) {
  var self = this;

  if (!this._db.isOpen()) {
    return this._db.once('ready', () => this.start(done));
  }

  self._server.listen(this._config.port, this._config.hostname, function(err) {
    if (err) {
      logger.error(err, 'error starting server');
      self.emit('error', err);
      if (done) {
        done(err);
      }
      return;
    }

    var address = self._server.address();
    logger.info(address, 'server started');
    self.emit('started', address);
    if (done) {
      done(null, address);
    }
  });

  return this;
};

LimitdServer.prototype.stop = function (callback) {
  var self = this;
  var address = self._server.address();
  callback = cb(callback || _.noop).timeout(5000).once();
  logger.info(address, 'closing server');

  this._server.destroy((serverCloseError) => {
    if (serverCloseError) {
      logger.error({
        err: serverCloseError,
        address
      }, 'error closing the tcp server');
    } else {
      logger.debug({ address }, 'server closed');
    }
    this._db.close(dbCloseError => {
      if (dbCloseError) {
        logger.error({
          err: dbCloseError
        }, 'error closing the database');
      } else {
        logger.info('database closed');
      }
      self.emit('close');
      return callback(serverCloseError || dbCloseError);
    });
  });

};


module.exports = LimitdServer;

