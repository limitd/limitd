var RequestMessage = require('../../messages').Request;
var _ = require('lodash');

var inverse_lookup = _.reduce(RequestMessage.Method, function (r, value, key) {
  r[value] = require('./' + key.toLowerCase());
  return r;
}, {});

module.exports.get = function (method) {
  return inverse_lookup[method];
};