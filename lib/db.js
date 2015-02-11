var level    = require('level');
var ttl      = require('level-ttl');
var serial   = require('level-serial');
var spaces   = require('level-spaces');


exports.get = function (config) {
  var db = level(config.DB, { valueEncoding: 'json' });

  db = ttl(db, {
    checkFrequency: process.env.NODE_ENV === 'test' ? 200 : 10000
  });

  db.buildSpace = function (name) {
    return serial(spaces(db, name, { valueEncoding: 'json' }));
  };

  return db;
};