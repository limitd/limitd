var express      = require('express');
var http         = require('http');
var app          = express();
var LimitdClient = require('../../client');

var limitdClient = new LimitdClient({
  address: 'localhost',
  port:    9231
});

limitdClient.on('error', function (err) {
  if (err.code === 'ECONNREFUSED') {
    console.error('You must run the limitd server first');
    console.error('\tlimitd --config-file limitd.yml');
    return process.exit(1);
  }
  console.log('limitdClient error', err);
});

app.get('/', function (req, res, next) {
  limitdClient.take('ip', req.ip, 1, function (err, response) {
    if (err) return next(err);
    if (!response.conformant) {
      return res.status(429).send('Too Many Requests');
    }
    next();
  });
}, function (req, res) {
  res.send('hello world!');
});

app.get('/throttled', function (req, res, next) {
  limitdClient.wait('ip', req.ip, 1, function (err, respose) {
    if (err) return next(err);
    req.delayed = respose.delayed;
    next();
  });
}, function (req, res) {
  res.send('hello world! Delayed: ' + req.delayed);
});


http.createServer(app).listen(9000, function (err) {
  console.log('listening on http://localhost:9000');
});