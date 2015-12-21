var path   = require('path');
var async  = require('async');
var rimraf = require('rimraf');
var _      = require('lodash');
var Stats  = require('fast-stats').Stats;
var Table  = require('cli-table');
var ProgressBar = require('progress');


var LimitdClient = require('../client');
var LimitdServer = require('../server');

var db_file = path.join(__dirname, 'db', 'perf.tests.db');

var protocol = process.argv.indexOf('--avro')  > -1 ? 'avro' : 'protocol-buffers';

try{
  rimraf.sync(db_file);
} catch(err){}

var server = new LimitdServer({
  db:        db_file,
  log_level: 'error',
  protocol:  protocol,
  buckets: {
    ip: {
      per_second: 10
    }
  }
});


server.start(function (err, address) {
  if (err) {
    console.error(err.message);
    return process.exit(1);
  }
  var client = new LimitdClient(_.extend({ protocol: protocol }, address));
  client.once('ready', run_tests);
});


function run_tests () {
  var client = this;
  var started_at = new Date();

  var requests = 100000;
  var concurrency = 1000;

  var progress = new ProgressBar(':bar', { total: requests , width: 50 });

  async.mapLimit(_.range(requests), concurrency, function (i, done) {
    var date = new Date();

    return client.ping(function (err, result) {
      progress.tick();
      if (err) {
        console.dir(err);
        return process.exit(1);
      }
      done(null, {
        err: err,
        result: result,
        took: new Date() - date
      });
    });

  }, function (err, results) {
    if (err) {
      console.error(err.message);
      return process.exit(1);
    }

    var took    = new Date() - started_at;
    var errored = _.filter(results, 'err');

    var times = _(results).filter(function (r) { return !r.err; }).map('took').value();
    var stats = new Stats().push(times);

    var table = new Table();


    table.push(
        { 'Protocol':   protocol                        },
        { 'Requests':   requests                        },
        { 'Total time': took + ' ms'                    },
        { 'Errored':    errored.length                  },
        { 'Mean':       stats.amean().toFixed(2)        },
        { 'P50':        stats.percentile(50).toFixed(2) },
        { 'P95':        stats.percentile(95).toFixed(2) },
        { 'P97':        stats.percentile(97).toFixed(2) },
        { 'Max':        _.max(times)                    },
        { 'Min':        _.min(times)                    }
    );

    console.log(table.toString());

    process.exit(0);

  });
}

