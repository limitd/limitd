'use strict';

const Transform = require('stream').Transform;
const Protocol  = require('limitd-protocol');

class RequestDecoder extends Transform {
  constructor() {
    super({ objectMode: true });
  }

  _transform(chunk, encoding, callback) {
    const decoded = Protocol.Request.decode(chunk);
    callback(null, decoded);
  }
}

module.exports = RequestDecoder;
