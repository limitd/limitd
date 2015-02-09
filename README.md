limitd is a simple daemon for highly available applications that needs rate limits.

## Motivations

While there are many solutions that relies on a central database like redis, these solutions tipically put all the configuration, limits and logic on the application side.

## Core concepts

The core concepts of limitd are:

-  [Token Bucket](http://en.wikipedia.org/wiki/Token_bucket): is the main algorithm used by limitd.
-  **Bucket Class**: defines the behavior of a bucket instance. Classes are defined in the configuration of the server. Eg: **ApiCall** 150 per hour.
-  **Bucket Instance**: is the incarnation of a bucket. Eg: **Customer 123 Api Call**. Bucket instances are:
    -  Created on demand.
    -  Destroyed when not used.
-  **Request**: a request made by a client to take **N tokens** from the **bucket instance X** of the **bucket class y**.
-  **Response**: is the response from the server to a client request indicating that the operation was succesful or not.

Limitd doesn't take care of throttling, the application is in charge of handling non-conformant traffic.

Limitd uses protocol uses [Protocol Buffers](https://developers.google.com/protocol-buffers) over tcp. The definition of the protocol are in [/blob/master/messages/limitd.proto].

## About this module

limitd is a node.js module that works as:

-  **limitd** server implementation (install with `-g`).
-  **limitdctl** is a command line utility (install with `-g`).
-  node.js client library for limitd  (install with local).

## Server

Install limitd server by running:

```
npm i -g limitd
```

In order to run an instance of limitd you will need a configuration file like this:

```yaml
#port to listen
port: 9001

#path where the data will be stored
db: /var/limitd/database

#buckets definitions
buckets:
  #The ip bucket is a bucket of max size 10 tokens.
  #1 token is added back to the bucket every 1 sec.
  ip:
    size:         10
    per_interval: 1
    interval:     1000
```

Create a daemon (upstart, systemd, initd, etc.) that runs the following command

```bash
limitd --config-file /etc/limitd.config > /var/log/limitd.log
```

## Client

Install the limitd client in your application as follows:

```
npm i limitd --save
```

Initialize limitd as follows:

```javascript
var LimitdClient = require('limitd');
var limitdClient = new LimitdClient({
  host: '192.168.1.1',
  port: 9001
});
```

Example express middleware:

```javascript
app.use(function (req, res, next) {
  limitdClient.request('ip', req.ip, function (err, resp) {
    if (err) return next(err);
    if (resp.conformant) return next();

    // The 429 status code indicates that the user has sent too many
    // requests in a given amount of time ("rate limiting").
    res.send('429');
  });
})
```

## cli tool (not done yet)

limitdctl comes with limitd:

```
npm i -g limitd
```

Usage:

```
limitdctl --host 192.168.1.1 --port 9001 <bucket> <instance> [<count>]
```

Example:

```
$ limitdctl --host 192.168.1.1 --port 9001 ip 101.123.12.1
conformant
$ echo $?
0

$ limitdctl --host 192.168.1.1 --port 9001 ip 101.123.12.1
non-conformant
$ echo $?
1
```

## License

MIT 2014 - Auth0 INC,