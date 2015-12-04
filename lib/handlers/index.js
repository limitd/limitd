var RequestMessage = require('../../messages').Request;
var _ = require('lodash');

var inverse_lookup = _.reduce(RequestMessage.Method, function (r, value, key) {
  r[value] = key;
  return r;
}, {});

module.exports.get = function (method) {
  return require('./' + inverse_lookup[method].toLowerCase());
};