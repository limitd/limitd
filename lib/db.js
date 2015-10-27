var level      = require('level');
var ttl        = require('level-ttl');
var serial     = require('level-serial');
var Sublevel   = require('level-sublevel');
var replicator = require('level-replicator');
var _          = require('lodash');
var spaces     = require('level-spaces');

module.exports = function (config, logger) {
  var db = level(config.db, { valueEncoding: 'json' });

  // db = Sublevel(db);

  db = ttl(db, {
    checkFrequency: process.env.NODE_ENV === 'test' ? 100 : 10000
  });


  if (config.replication_port) {
    var offline_nodes = {};
    db.on('error', function (err) {
      if (err.code === 'ENFILE') {
        return logger.error({ err: err }, 'error from db');
      }
      if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
        var peer = [ err.host, err.port ].join(':');
        if (!offline_nodes[peer]) {
          offline_nodes[peer] = true;
          logger.info({ host: err.host, port: err.port, status: 'offline' }, 'node is offline');
          db.once('connected to ' + [ err.host, err.port ].join(':'), function reconnect (host, port) {
            delete offline_nodes[peer];
            logger.info({ host: host, port: port, status: 'online'}, 'node is online');
          });
        }
        return;
      }
      logger.error({ err: err }, 'error from db');
      process.exit(1);
    });

    db = replicator(db, {
      port:  config.replication_port,
      peers: config.peers.reduce(function (result, peer) {
        result[peer] = Date.now();
        return result;
      }, {}),
      id: config.instance_id,
      resolver: function(a, b) { return a.timestamp > b.timestamp; }
    });
  }

  db.buildSpace = function (name) {
    // return serial(db.sublevel(name));
    // return serial(spaces(db, name));
    return serial(db);
  };

  return db;
};