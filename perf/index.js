const path   = require('path');
const async  = require('async');
const rimraf = require('rimraf');
const _      = require('lodash');
const Stats  = require('fast-stats').Stats;
const Table  = require('cli-table');
const ProgressBar = require('progress');


const LimitdServer = require('../server');
const LimitdClient = require('limitd-client');

const db_file = path.join(__dirname, 'db', 'perf.tests.db');
const protocol = process.argv.indexOf('--avro')  > -1 ? 'avro' : 'protocol-buffers';
const profile = process.argv.indexOf('--profile') > -1;

const cluster = require('cluster');


const fs = require('fs');
const profiler = require('v8-profiler');

if (cluster.isMaster) {
  try{
    rimraf.sync(db_file);
  } catch(err){}

  const server = new LimitdServer({
    db:        db_file,
    log_level: 'error',
    protocol:  protocol,
    buckets: {
      ip: {
        per_second: 10
      }
    }
  });


  server.start((err, addr) => {
    if (err) {
      console.error(err.message);
      return process.exit(1);
    }
    if (profile) {
      console.log('starting profiler');
      profiler.startProfiling();
    }
    cluster.fork({LIMITD_HOST: `limitd://${addr.address}:${addr.port}`});
  });


  cluster.on('exit', (worker, code) => {
    if (profile) {
      const p = profiler.stopProfiling();
      return p.export()
                    .pipe(fs.createWriteStream(`${__dirname}/profile.cpuprofile`))
                    .on('finish', function() {
                      console.log('profile stored');
                      p.delete();
                      process.exit(0);
                    });
    }
    process.exit(code);
  });
} else {
  const client = new LimitdClient({ protocol: protocol, timeout: '60s', host: process.env.LIMITD_HOST });

  client.once('ready', function() {
    var client = this;
    var started_at = new Date();

    var requests = 100000;
    var concurrency = 10000;

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
  });
}



