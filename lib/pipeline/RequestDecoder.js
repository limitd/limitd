'use strict';

const Transform = require('stream').Transform;
const Protocol  = require('limitd-protocol');

class RequestDecoder extends Transform {
  constructor() {
    super({ objectMode: true });
  }

  _transform(chunk, encoding, callback) {
    const decoded = Protocol.Request.decode(chunk);
    decoded.startTs = Date.now();

    callback(null, decoded);
  }
}

module.exports = RequestDecoder;
