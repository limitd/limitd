
const cb = require('cb');
const net = require('net');
const util = require('util');
const _  = require('lodash');
const LimitDB = require('limitdb');
const agent = require('./lib/agent');
const lps = require('length-prefixed-stream');
const enableDestroy = require('server-destroy');
const EventEmitter = require('events').EventEmitter;
const validateConfig = require('./lib/config_validator');
const RequestHandler  = require('./lib/pipeline/RequestHandler');
const RequestDecoder  = require('./lib/pipeline/RequestDecoder');
const ResponseEncoder = require('./lib/pipeline/ResponseEncoder');
const stream = require('stream');


const logger  = agent.logger;

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

  this._server.on('error', (err) => {
    this.emit('error', err);
  });

  const dbConfig = { types: this._config.buckets };

  if (typeof this._config.db === 'string') {
    dbConfig.path = this._config.db;
  } else if (typeof this._config.db === 'object') {
    Object.assign(dbConfig, this._config.db);
  }

  this._db = new LimitDB(dbConfig);
  this._db
    .on('ready', () => {
      logger.info({ path: dbConfig.path }, 'Database ready.');
    })
    .on('error', (err) => {
      logger.error({ err });
    })
    .on('repairing', () => {
      logger.info({ path: dbConfig.path }, 'Repairing database.');
    });

  // Let's be a little defensive so we avoid orchestration requirement
  this._latencyBuckets = Array.isArray(this._config.latency_buckets) ? this._config.latency_buckets : [];
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

  logger.info(sockets_details, 'connection accepted');

  const decoder = new RequestDecoder();

  decoder.on('error', function (err) {
    logger.error(_.extend(sockets_details, { err }), 'Error detected in the request pipeline.');
    return socket.end();
  });

  const request_handler = new RequestHandler({
    db: this._db
  });

  request_handler.once('error', (err) => {
    logger.error(_.extend(sockets_details, { err }), 'Error detected in the request pipeline.');
    socket.end();
  });

  const encoder = new ResponseEncoder();
  const latencyBuckets = this._latencyBuckets;

  socket.pipe(lps.decode())
    .pipe(decoder)
    .pipe(request_handler)
    // This is equivalent to a PassThrough which logs the latency as close
    // from the moment as close to the decoder and encoder as possible
    .pipe(new stream.Transform({
      objectMode: true,
      transform(result, encoding, callback) {
        const duration = Date.now() - result.request.startTs;

        agent.metrics.observeBucketed('operation.latency',
          duration,
          latencyBuckets,
          { method: result.request.method });

        this.push(result);
        callback();
      }
    }))
    .pipe(encoder)
    .pipe(lps.encode())
    .pipe(socket);
};

LimitdServer.prototype.start = function (done) {
  if (!this._db.isOpen()) {
    return this._db.once('ready', () => {
      this.start(done);
    });
  }

  this._server.listen(this._config.port, this._config.hostname, (err) => {
    if (err) {
      logger.error(err, 'error starting server');
      this.emit('error', err);
      if (done) {
        done(err);
      }
      return;
    }

    var address = this._server.address();
    logger.info(address, 'server started');
    this.emit('started', address);
    if (done) {
      done(null, address);
    }
  });

  return this;
};

LimitdServer.prototype.stop = function (callback) {
  var address = this._server.address();
  callback = cb(callback || _.noop).timeout(5000).once();
  logger.info(address, 'closing server');

  this._server.destroy((serverCloseError) => {
    if (serverCloseError) {
      logger.error({
        err: serverCloseError,
        address
      }, 'error closing the tcp server');
    } else {
      logger.info({ address }, 'server closed');
    }
    this._db.close((dbCloseError) => {
      if (dbCloseError) {
        logger.error({
          err: dbCloseError
        }, 'error closing the database');
      } else {
        logger.info('database closed');
      }
      this.emit('close');
      return callback(serverCloseError || dbCloseError);
    });
  });
};

LimitdServer.prototype.updateTypes = function (types) {
  this._db.loadTypes(types);
};

module.exports = LimitdServer;
