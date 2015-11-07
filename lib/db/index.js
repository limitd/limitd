var leveldb = require('./leveldb');

module.exports = function (dbPath) {
  return leveldb(dbPath);
};