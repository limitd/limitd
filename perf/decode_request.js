const buffer = new Buffer([ 10, 7, 77, 84, 65, 57, 83, 121, 55, 18, 2, 105, 112, 26, 13, 50, 49, 49, 46, 49, 50, 51, 46, 49, 50, 46, 49, 50, 32, 0, 40, 1, 48, 0 ]);
const assert = require('assert');
const _ = require('lodash');

const Protocol = require('limitd-protocol');
const MethodMap = new Map(_.map(Protocol.Request.Method, (v, k) => [v, k]));
const ProtocolBufferRequest = require('../messages/protocol_buffers').Request;

const uintArray = Uint8Array.from(buffer);
const Pbf = require('pbf');
const PBFRequest = require('../messages/pbf_Request').Request;

exports.compare = {
  "google-protobuf" : function () {
    const decoded = Protocol.Request.deserializeBinary(Uint8Array.from(buffer)).toObject();
    decoded.method = MethodMap.get(decoded.method);
    assert.equal(decoded.method, 'TAKE');
  },
  "google-protobuf (no resolving enum)" : function () {
    const decoded = Protocol.Request.deserializeBinary(Uint8Array.from(buffer)).toObject();
    assert.equal(decoded.method, 0);
  },
  "google-protobuf (no array conversion)" : function () {
    const decoded = Protocol.Request.deserializeBinary(uintArray).toObject();
    decoded.method = MethodMap.get(decoded.method);
    assert.equal(decoded.method, 'TAKE');
  },
  "google-protobuf (no array conversion, no resolving enum)" : function () {
    const decoded = Protocol.Request.deserializeBinary(uintArray).toObject();
    assert.equal(decoded.method, 0);
  },
  'protobufjs': () => {
    const decoded = ProtocolBufferRequest.decode(buffer).toJSON();
    assert.equal(decoded.method, 'TAKE');
  },
  'pbf': () => {
    const pbf = new Pbf(buffer);
    const decoded = PBFRequest.read(pbf);
    decoded.method = MethodMap.get(decoded.method);
    assert.equal(decoded.method, 'TAKE');
  }
};

require("bench").runMain();
