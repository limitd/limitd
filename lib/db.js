var level    = require('level');
var ttl      = require('level-ttl');
var serial   = require('level-serial');
var spaces   = require('level-spaces');


exports.get = function (config) {
  var db = level(config.DB, { valueEncoding: 'json' });

  db.buildSpace = function (name) {
    return serial(ttl(spaces(db, name, { valueEncoding: 'json' })));
  };

  return db;
};