limitd is a simple daemon for rate limiting highly available applications.

## Example usage in node.js

Initialize the limitd client as follows:

```javascript
var LimitdClient = require('limitd').Client;
var limitd = new LimitdClient('limitd://10.0.0.23:9231');
```

Example with express throttling requests:

```javascript
app.use(function (req, res, next) {
  limitd.wait('ip', req.ip, function (err) {
    next();
  });
})
```

Example with express responding [429 Too Many Requests](http://tools.ietf.org/html/rfc6585#section-4):

~~~javascript
app.use(function (req, res, next) {
  limitd.take('user', req.username, function (err, resp) {
    if (err) return next(err);

    req.set({
      'X-RateLimit-Limit':     resp.limit,
      'X-RateLimit-Remaining': resp.remaining
      'X-RateLimit-Reset':     resp.reset
    });

    if (resp.conformant) return next();

    // The 429 status code indicates that the user has sent too many
    // requests in a given amount of time ("rate limiting").
    res.send('429');
  });
})
~~~

## Server Configuration

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

#Define the classes of buckets
buckets:
  ip:
    size: 10
    per_interval: 1
    interval: 200
    override:
      127.0.0.1:
        size: 10000
        per_interval: 100
  user:
    size: 5
```

Create a daemon (upstart, systemd, initd, etc.) that runs the following command

```bash
limitd --config-file /etc/limitd.config > /var/log/limitd.log
```

## Motivation

While there are many solutions that relies on a central database like redis, these solutions tipically put all the configuration, limits and logic on the application side.

## Core concepts

The core concepts of limitd are:

-  [Token Bucket](http://en.wikipedia.org/wiki/Token_bucket): is the main algorithm used by limitd.
-  **Bucket Class**: defines the behavior of a bucket instance. Classes are defined in the configuration of the server. Eg: **ApiCall** 150 per hour.
-  **Bucket Instance**: is the incarnation of a bucket. Eg: **Customer 123 Api Call**. Bucket instances are:
    -  Created on demand.
    -  Destroyed when not used.
-  **Request**: a request made by a client to  **take or wait** N tokens from the **bucket instance X** of the **bucket class y**.
-  **Response**: is the response from the server to a client request indicating that the operation was succesful or not.

Limitd protocol uses [Protocol Buffers](https://developers.google.com/protocol-buffers) over tcp. The definition of the protocol are in [messages/limitd.proto](/blob/master/messages/limitd.proto).

## Server operations

-  **TAKE**: remove one or more tokens from the bucket. The server will respond inmediately with `conformant` true/false depending if there are sufficient tokens.
-  **WAIT**: remove one or more tokens from the bucket. If there are insufficient tokens in the bucket the server will not respond the request until there are enought tokens.
-  **PUT**: fill the bucket with one or more tokens. The max amount of tokens depends on the size of the bucket. This is useful when the application need to reset a bucket that's not autofilled by limitd.

## About this module

limitd is a node.js module that works as:

-  **limitd** server implementation (install with `-g`).
-  **limitdctl** is a command line utility (install with `-g`).
-  node.js client library for limitd  (install with local).

## License

MIT 2014 - Auth0 INC.