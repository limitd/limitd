const rdy = require('rdy');
const countn = require('countn');
const async = require('neo-async');
const _ = require('lodash');
const start = process.hrtime();
const fixture = _.range(1e5);

function finish() {
  const diff = process.hrtime(start);
  const ns = diff[0] * 1e9 + diff[1];
  const ms = Math.ceil(ns / 1e6);
  console.log(`Benchmark took ${ms} ms`);
}

// async
// async.each(fixture, (i, done) => setImmediate(done), () => {
//   finish();
// });

//// manual
var finished = 0;

const done = (_err) => {
  finished++;
  var err = err || _err;
  if (finished === fixture.length) {
    finish();
  }
};

//faster than async.each
for(var i = 0; i < fixture.length; i++) {
  setImmediate(done);
}


// const onceAllFinish = countn(fixture.length, finish);
// for(var i = 0; i < fixture.length; i++) {
//   setImmediate(onceAllFinish);
// }


// const onceAllFinish = rdy(fixture.length, finish);
// for(var i = 0; i < fixture.length; i++) {
//   setImmediate(onceAllFinish);
// }
