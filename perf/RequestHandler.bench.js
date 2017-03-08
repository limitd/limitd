const RequestHandler = require('../lib/pipeline/RequestHandler');
const profiler = require('v8-profiler');
const PassThrough = require('readable-stream').PassThrough;
const Readable = require('readable-stream').Readable;
const fs = require('fs');

const objects = 1000000;
var pushed = 0;

const readable = Readable({
  objectMode: true,
  highWaterMark: 100,
  read() {
    var reading = true;
    while(reading) {
      const index = pushed++;
      if (index === objects) {
        return this.push(null);
      }
      reading = this.push({
        id:     `msg-${index}`,
        method: 'TAKE',
        type:   'ip',
        key:    '10.0.0.1'
      });
    }
  }
});

function dbTake(request, callback) {
  setImmediate(callback, null, { request_id: request.id });
}

const handler = new RequestHandler({
  db: {
    take: dbTake
  },
  logger: {}
});

var results = 0;

const start = process.hrtime();

// if (i === 400) {
    //   snapshot1 = profiler.takeSnapshot();
    // }
    // snapshot1.export()
    //   .pipe(fs.createWriteStream(`snapshot-1-${Date.now()}.heapsnapshot`))
    //   .on('finish', () => {
    //     snapshot1.delete();
    //

// var snapshot1, snapshot2;

readable
  .pipe(handler)
  .pipe(new PassThrough({ objectMode: true, highWaterMark: 1000 }))
  .on('data', () => {
    results++;
    // if (results === 40000) {
    //   snapshot1 = profiler.takeSnapshot();
    // }
    // if (results === 900000) {
    //   snapshot2 = profiler.takeSnapshot();
    // }

    if (results === objects) {
      const diff = process.hrtime(start);
      const ns = diff[0] * 1e9 + diff[1];
      const ms = Math.ceil(ns / 1e6);
      console.log(`Benchmark took ${ms} ms`);

      // snapshot1.export()
      //   .pipe(fs.createWriteStream(`snapshot-1-${Date.now()}.heapsnapshot`));

      // snapshot2.export()
      //   .pipe(fs.createWriteStream(`snapshot-2-${Date.now()}.heapsnapshot`));
    }
  });
