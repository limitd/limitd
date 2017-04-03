const path    = require('path');
const async   = require('async');
const rimraf  = require('rimraf');
const _       = require('lodash');
const Stats   = require('fast-stats').Stats;
const Table   = require('cli-table');
const spawn   = require('child_process').spawn;
const cluster = require('cluster');

const requests  =  200000;
const concurrency = 1000;
const client_count =  1; //os.cpus().length - 1;

function spawn_server() {

  try{
    const db_file = path.join(__dirname, 'db', 'perf.tests.db');
    rimraf.sync(db_file);
  } catch(err){}

  const run_with_profile = process.argv.indexOf('--profile') > -1;
  const flame_graph = process.argv.indexOf('--0x') > -1;
  const debug = process.argv.indexOf('--debug') > -1;

  var limitd_args = [
                      '--max_old_space_size=5000',
                      path.normalize(__dirname + '/../bin/limitd'),
                      '--config-file',
                      `${__dirname}/config.yml`,
                      '--db',
                      `${__dirname}/db`,
                    ];

  if (flame_graph) {
    limitd_args = [
      'node',
      '--trace-hydrogen',
      '--trace-phase=Z',
      '--trace-deopt',
      '--code-comments',
      '--hydrogen-track-positions',
      '--redirect-code-traces',
      '--redirect-code-traces-to=code.asm'
    ].concat(limitd_args);
  }

  if (run_with_profile) {
    limitd_args.push('--profile');
  }

  var executable = 'node';

  if (flame_graph) {
    executable = '0x';
  } else if (debug) {
    executable = 'node-debug';
  }

  return spawn(executable, limitd_args, { stdio: 'inherit' });
}

function render_results(started_at, results) {
  var took    = new Date() - started_at;
  var errored = _.filter(results, 'err');

  var times = _(results).filter(function (r) { return !r.err; }).map('took').value();
  var stats = new Stats().push(times);

  var table = new Table();

  table.push(
      { 'Requests':    requests * client_count         },
      { 'Concurrency': concurrency * client_count      },
      { 'Total time':  took + ' ms'                    },
      { 'RPS':         Math.floor((1000 * (requests * client_count)) / took) },
      { 'Errored':     errored.length                  },
      { 'Mean':        stats.amean().toFixed(2)        },
      { 'P50':         stats.percentile(50)            },
      { 'P60':         stats.percentile(60)            },
      { 'P70':         stats.percentile(70)            },
      { 'P80':         stats.percentile(80)            },
      { 'P90':         stats.percentile(90)            },
      { 'P95':         stats.percentile(95)            },
      { 'P97':         stats.percentile(97)            },
      { 'Max':         _.max(times)                    },
      { 'Min':         _.min(times)                    }
  );

  console.log(table.toString());
}

if (cluster.isMaster) {
  process.title = 'limitd perfomance master';

  var results = [];
  const started_at = new Date();

  const server = spawn_server();

  console.log('server pid:', server.pid);

  const workers = _.range(client_count).map(() => cluster.fork());


  workers.forEach((worker) => {
    worker.once('message', (message) => {
      results = results.concat(message.results);
      if (results.length === client_count * requests) {
        console.log('rendering stats');
        render_results(started_at, results);
        server.kill('SIGINT');
        try{
          const db_file = path.join(__dirname, 'db', 'perf.tests.db');
          rimraf.sync(db_file);
        } catch(err){}
      }
      worker.kill();
    });
  });

  return;
}


const LimitdClient = require('limitd-client');

const clients = _.range(10).map(() => {
  const client = new LimitdClient({
    host: '/tmp/limitd.socket',
    timeout: 60000,
    protocol_version: 2
  });

  client.once('ready', waitAll);

  return client;
});

function waitAll(){
  if(clients.every(c => c.socket && c.socket.connected)){
    run_tests();
  }
}


function run_tests () {
  async.mapLimit(_.range(requests), concurrency, function (i, done) {
    const clientIndex = i % clients.length;
    const client = clients[clientIndex];
    const start = process.hrtime();
    return client.take('ip', 'uh-oh-' + i, function (err, result) {
      if (err) {
        console.dir(err);
        return process.exit(1);
      }

      const diff = process.hrtime(start);
      const took = Math.ceil((diff[0] * 1e9 + diff[1]) / 1e6);

      done(null, { result, took });
    });

  }, function (err, results) {
    if (err) {
      console.error(err.message);
      return process.exit(1);
    }

    process.send({
      type: 'finish',
      results
    });
  });
}

