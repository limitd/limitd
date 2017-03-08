const async            = require('async');
const _                = require('lodash');
const Stats            = require('fast-stats').Stats;
const Table            = require('cli-table');
const ProgressBar      = require('progress');
const split2           = require('split2');
const randomstring     = require('randomstring');
const profile          = process.argv.indexOf('--profile') > -1;
const cluster          = require('cluster');
const Transform        = require('stream').Transform;
const Writable         = require('stream').Writable;
const fs               = require('fs');
const profiler         = require('v8-profiler');
const net              = require('net');

if (cluster.isMaster) {
  const server = net.createServer(socket => {

    const streamWriter = Transform({
      objectMode: true,
      transform(obj, enc, callback) {
        callback(null, JSON.stringify(obj) + '\n');
      }
    });

    streamWriter.pipe(socket);

    socket.pipe(split2())
          .pipe(Transform({
            objectMode: true,
            transform(line, enc, callback) {
              callback(null, JSON.parse(line));
            }
          }))
          .pipe(Writable({
            objectMode: true,
            write(obj, enc, callback) {
              streamWriter.write({ request_id: obj.id });
              callback();
            }
          }));
  });

  server.listen(() => {
    if (profile) {
      console.log('starting profiler');
      profiler.startProfiling();
    }
    const addr = server.address();
    console.log('listening on', addr.port);
    cluster.fork({LIMITD_PORT: addr.port});
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
  const client = net.connect({ port: parseInt(process.env.LIMITD_PORT) }, () => {
    const pendingRequests = {};

    client.pipe(split2()).pipe(Writable({
      objectMode: true,
      write(line, enc, callback) {
        const response = JSON.parse(line);
        pendingRequests[response.request_id](null, response);
        callback();
      }
    }));

    const started_at = new Date();
    const requests = 100000;
    const concurrency = 10000;

    const progress = new ProgressBar(':bar', { total: requests , width: 50 });

    async.mapLimit(_.range(requests), concurrency, function (i, done) {
      var date = new Date();

      const reponseCallback = function (err, result) {
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
      };

      const id = i;
      pendingRequests[id] = reponseCallback;
      client.write(JSON.stringify({ method: 'PING', id }) + '\n');

    }, function (err, results) {
      if (err) {
        console.error(err.message);
        return process.exit(1);
      }

      const took    = new Date() - started_at;
      const errored = _.filter(results, 'err');

      const times = _(results).filter(function (r) { return !r.err; }).map('took').value();
      const stats = new Stats().push(times);

      const table = new Table();


      table.push(
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



