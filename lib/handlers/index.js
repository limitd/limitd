var fs = require('fs');
var _ = require('lodash');

var modules = {};

_.without(fs.readdirSync(__dirname), 'index.js')
  .forEach(function (file) {
    modules[file.slice(0, -3).toUpperCase()] = require('./' + file);
  });

module.exports.get = function (method) {
  return modules[method];
};