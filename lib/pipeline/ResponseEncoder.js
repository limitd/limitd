'use strict';

const Transform = require('stream').Transform;
const Protocol  = require('limitd-protocol');

const mappers = {
  'TAKE':  (request, response) => ({ request_id: request.id, 'take': response }),
  'WAIT':  (request, response) => ({ request_id: request.id, 'take': response }),
  'PUT':   (request, response) => ({ request_id: request.id, 'put': response }),
  'PING':  (request, response) => ({ request_id: request.id, 'pong': response }),
  'STATUS': (request, response) => {
    return {
      request_id: request.id,
      'status': {
        items: response.items.map(i => ({
          remaining: i.remaining,
          reset:     i.reset,
          limit:     i.limit,
          instance:  i.key
        }))
      }
    };
  }
};

class ResponseEncoder extends Transform {
  constructor() {
    super({ objectMode: true });
  }

  _transform(rr, encoding, callback) {
    var response;

    if (typeof rr.response.error !== 'undefined') {
      response = {
        request_id: rr.request.id,
        error: rr.response.error
      };
    } else {
      response = mappers[rr.request.method](rr.request, rr.response);
    }

    const encoded = Protocol.Response.encode(response);
    this.push(encoded);
    callback();
  }
}

module.exports = ResponseEncoder;
