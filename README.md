[![Build Status](https://travis-ci.org/auth0/limitd.svg)](https://travis-ci.org/auth0/limitd)

limitd is a simple daemon for rate limiting highly available applications.

## Usage
In order to use **limitd** you need to setup the server and consume it from the client.

This example assumes that you want to implement rate limiting for an express application.

### node.js client
To instantiate the **limitd** client:

```javascript
var LimitdClient = require('limitd-client');
var limitd = new LimitdClient('limitd://localhost:9001');
```

Add a middleware to your express application to reply with [429 Too Many Requests](http://tools.ietf.org/html/rfc6585#section-4) in case the limit is reached:

```javascript
app.use(function (req, res, next) {
  limitd.take('user', req.username, function (err, resp) {
    if (err) return next(err);

    res.set({
      'X-RateLimit-Limit':     resp.limit,
      'X-RateLimit-Remaining': resp.remaining,
      'X-RateLimit-Reset':     resp.reset
    });

    if (resp.conformant) return next();

    // The 429 status code indicates that the user has sent too many
    // requests in a given amount of time ("rate limiting").
    res.send('429');
  });
})
```

The client API is documented [below](#client_api).


### Server setup

Install on debian with

```
sudo sh -c 'echo deb http://debs.auth0.com/ stable main > /etc/apt/sources.list.d/auth0.list'
sudo apt-key adv --keyserver keyserver.ubuntu.com --recv F63E3D3A
sudo aptitude update
sudo aptitude install -y limitd
```

On other systems use node.js and npm:
```
npm i -g limitd
```

Create a file named `limitd.config` for the server settings:
```yaml
#port to listen on
port: 9001

#db path
db: /var/limitd/database

#define the bucket types
buckets:
  user:
    size: 10
    per_second: 5
```

Start the server:
```bash
limitd --config-file /etc/limitd.config
```

You can find all configuration options [below](#server_options).

> **Note**: For production you would create a daemon (upstart, systemd, initd, etc.) that runs the aforementiond command.

## Motivation

While there are many solutions that relies on a central database like redis, these solutions tipically put all the configuration, limits and logic on the application side.

## Core concepts

The core concepts of limitd are:

-  [Token Bucket](http://en.wikipedia.org/wiki/Token_bucket): is the main algorithm used by limitd.
-  **Bucket Type**: defines the behavior of a bucket instance. Types are defined in the configuration of the server. Eg: **ApiCall** 150 per hour.
-  **Bucket Instance**: is the incarnation of a bucket. Eg: **Customer 123 Api Call**. Bucket instances are:
    -  Created on demand.
    -  Destroyed when not used.
-  **Request**: a request made by a client to  **take or wait** N tokens from the **bucket instance X** of the **bucket type y**.
-  **Response**: is the response from the server to a client request indicating that the operation was succesful or not.

Limitd protocol uses [Protocol Buffers](https://developers.google.com/protocol-buffers) over tcp. The definition of the protocol are in [protocol/messages](https://github.com/limitd/protocol/tree/master/messages).

## Server operations

-  **TAKE**: remove one or more tokens from the bucket. The server will reply immediately with `conformant` true/false depending if there are sufficient tokens.
-  **WAIT**: remove one or more tokens from the bucket. If there aren't enough tokens in the bucket the server will not reply until there are.
-  **PUT**: put one or more tokens into the bucket. The max amount of tokens depends on the bucket size. This is useful when the application needs to reset a bucket that's not autofilled by limitd.

<a name="server_options"></a>
## Server options
The server configuration file uses [YAML](http://www.yaml.org/).

### `port`
* Type: `Number`
* Description: Specifies the port to use to run the server. If not provided the default is `9231`.

### `db`
* Type: `Number`
* Description: Specifies the path for the server database. This is a mandatory parameter.

### `buckets`

### `buckets.{type}`

* Type: `Object`
* Description: Specifies the configuration for a bucket type.

### `buckets.{type}.size`

* Type: `Number`
* Description: Specifies the size of the bucket. Defaults to 0.

### `buckets.{type}.per_{interval}`

* Type: `Number`
* Values: `per_second`, `per_minute`, `per_hour`, `per_day`.
* Description: Specifies the amount of tokens to add to the bucket per interval.
* Notes: Only specify one interval.

### `buckets.{type}.override`

### `buckets.{type}.override.{key}`

* Type: `Object`
* Description: Specifies custom configuration for a bucket with the specified `key` for the particular `type`.

### `buckets.{type}.override.{key}.size`

* Type: `Number`
* Description: Specifies the size of the bucket. Defaults to 0.

### `buckets.{type}.override.{key}.per_{interval}`

* Type: `Number`
* Values: `per_second`, `per_minute`, `per_hour`, `per_day`.
* Description: Specifies the amount of tokens to add to the bucket per interval.
* Notes: Only specify one interval.

### `buckets.{type}.override.{key}.match`

* Type: `String`
* Description: When `{key}` contains dynamic values (i.e: IPs) you can filter using a regular expression over the `key`.
* Usage: `!!js/regexp /pattern/gim` where the `pattern` is a javascript regular expression pattern and `gim` are the [options](https://developer.mozilla.org/en/docs/Web/JavaScript/Guide/Regular_Expressions#Advanced_searching_with_flags) to be applied.


<a name="client_api"></a>
## Client API

### `LimitdClient(serverUri)`
**Constructor**. Creates an instance of the `LimitdClient` passing the server's uri.

**Parameters**
* `serverUri: String` - A valid URI with "limitd" schema with the TCP address of the server. If no port is provided the default port is `9231`.

### `LimitdClient(options)`
**Constructor**. Creates an instance of the `LimitdClient` passing the server's uri.

**Parameters**
* `options?: Object` - An optional object whose properties are the client configuration settings.
  * `host?: String` - The limitd server host name or IP address. If not provided `"localhost"` is used.
  * `port?: Number` - The limitd server port number. If not provided `9231` is used.

### `client.connect(done)`
Connects the client to the server.

**Parameters**
* `done?: () => any` - An optional function to be invoked when a connection is established. It receives no parameters.

### `client.take(type, key, count, done)`
Removes `count` tokens from the `key` bucket in of the `type` token type. If there weren't enough tokens then `response.conformant` will be `false`, `true` otherwise.

**Parameters**

* `type: String` - The bucket type.
* `key: String` - The bucket key inside `type`.
* `count?: Number` - An optional amount of tokens to take from the bucket. Defaults to `1` if not provided.
* `done?: (err, response: TakeResponse)` - An optional callback. If an error occurs it will be in `err`. Otherwise, the result will be in `response`.

### `client.wait(type, key, count, done)`
Removes `count` tokens from the `key` bucket in of the `type` token type. If there were not enough tokens the response is delayed until there are.

**Parameters**

* `type: String` - The bucket type.
* `key: String` - The bucket key inside `type`.
* `count?: Number` - An optional amount of tokens to take from the bucket. Defaults to `1` if not provided.
* `done?: (err, response: WaitResponse)` - An optional callback. If an error occurs it will be in `err`. Otherwise, the result will be in `response`.

### `client.reset(type, key, done)`
Fills the `key` bucket of the `type` bucket type.

**Parameters**

* `type: String` - The bucket type.
* `key: String` - The bucket key inside `type`.
* `done?: (err, response: Response)` - An optional callback. If an error occurs it will be in `err`. Otherwise, the result will be in `response`.

### `client.put(type, key, count, done)`
Put `count` tokens in the `key` bucket of the `type` bucket type.

**Parameters**

* `type: String` - The bucket type.
* `key: String` - The bucket key inside `type`.
* `count?: Number` - An optional amount of tokens to put in the bucket. If not provided it is the same as invoking `client.reset(type, key, done)`.
* `done?: (err, response: Response)` - An optional callback. If an error occurs it will be in `err`. Otherwise, the result will be in `response`.

### class: `Response`
The `TakeResponse` is a class with the following properties:

* `remaining: Number`: The amount of tokens remaining in the bucket after the operation.
* `limit: Number`: The maximum amount of tokens available in the token.
* `reset: Number`: A UNIX timestamp of the expected time at which the bucket will be full again (full means `remaining === limit`).

### class: `TakeResponse extends Response`
The `TakeResponse` is a class with the following properties:

* `conformant: Boolean`: `true` if there were enough tokens in the bucket, `false` otherwise.

### class: `WaitResponse extends Response`
The `WaitResponse` is a class with the following properties:

* `delayed: Boolean`: `true` if the request was delayed waiting for enough tokens, `false otherwise`.

## Friends

limitd is a node.js module that works as:

-  **limitd** server implementation: this repository.
-  **limitdctl** is a command line utility: https://github.com/limitd/limitdctl
-  node.js client library for limitd: https://github.com/limitd/node-client

## Running Tests

To run the tests you need to have redis running on the default port (6379).

```sh
git clone --recurse git@github.com:auth0/limitd.git
cd limitd
npm i
npm test
```

## Issue Reporting

If you have found a bug or if you have a feature request, please report them at this repository issues section. Please do not report security vulnerabilities on the public GitHub issue tracker. The [Responsible Disclosure Program](https://auth0.com/whitehat) details the procedure for disclosing security issues.

## Author

[Auth0](auth0.com)

## License

This project is licensed under the MIT license. See the [LICENSE](LICENSE) file for more info.
