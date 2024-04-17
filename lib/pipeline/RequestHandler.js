'use strict';

const Duplex  = require('readable-stream').Duplex;
const agent = require('../agent');
const logger = agent.logger;

class RequestHandler extends Duplex {
  constructor(options) {
    super({
      writableObjectMode: true,
      readableObjectMode: true,
      highWaterMark: 50
    });
    this.db = options.db;
    this.queue = [];
  }

  _commonReponseHandler(request) {
    const tags = {
      method: request.method,
      type: request.type
    };

    const start = Date.now();

    return (err, result) => {
      const took = Date.now() - start;

      if (result &&
        typeof result.conformant !== 'undefined' &&
        result.conformant !== null) {
        tags.conformant = result.conformant;
      }

      if (err) {
        if (err.message.indexOf('undefined bucket type') > -1) {
          if (request.skipResponse) {
            logger.info({
              log_type: 'unknown_bucket_error',
              request,
              err
            }, 'Error detected in the request pipeline.');
          } else {
            this._queueResponse(request, { error: { type: 'UNKNOWN_BUCKET_TYPE' } });
          }
        } else {
          this.emit('error', err);
        }
        return;
      }

      logger.info({
        took:       took,
        method:     request.method,
        type:       request.type,
        key:        request.key,
        conformant: result.conformant
      }, request.method);

      if (request.skipResponse) {
        return;
      }

      this._queueResponse(request, result);
    };
  }

  _write(request, encoding, callback) {
    logger.debug({ request },'request');

    switch(request.method) {
      case 'PING':
        this._queueResponse(request, { request_id: request.id });
        break;
      case 'TAKE':
        this.db.take(request, this._commonReponseHandler(request));
        break;
      case 'WAIT':
        this.db.wait(request, this._commonReponseHandler(request));
        break;
      case 'PUT':
        this.db.put(request, this._commonReponseHandler(request));
        break;
      case 'GET':
        this.db.get(request, this._commonReponseHandler(request));
        break;
      case 'STATUS':
        this.db.status({ type: request.type, prefix: request.key }, this._commonReponseHandler(request));
        break;
      default:
        return callback(new Error(`unknown method ${request.method}`));
    }
    callback();
  }

  _writev(chunks, callback) {
    var finished = 0, err;
    const done = (_err) => {
      finished++;
      err = err || _err;
      if (finished === chunks.length) {
        return callback(err);
      }
    };

    //faster than async.each
    for(var i = 0; i < chunks.length; i++) {
      this._write(chunks[i].chunk, null, done);
    }
  }

  _queueResponse(request, response) {
    this.queue.push({ request, response });
    this._flush();
  }

  _flush() {
    let i;
    if (this.reading == null) {
      this.reading = true;
    }
    //faster than deque.
    for(i = 0; i < this.queue.length && this.reading; i++) {
      this.reading = this.push(this.queue[i]);
    }

    this.queue = i === this.queue.length ? [] : this.queue.slice(i);
  }

  _read() {
    this.reading = true;
    this._flush();
  }
}

module.exports = RequestHandler;
