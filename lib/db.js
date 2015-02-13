var level    = require('level');
var ttl      = require('level-ttl');
var serial   = require('level-serial');
var spaces   = require('level-spaces');

module.exports = function (dbPath) {
  var db = level(dbPath, { valueEncoding: 'json' });

  db = ttl(db, {
    checkFrequency: process.env.NODE_ENV === 'test' ? 100 : 10000
  });

  db.buildSpace = function (name) {
    return serial(spaces(db, name, { valueEncoding: 'json' }));
  };

  return db;
};