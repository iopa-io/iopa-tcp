# [![IOPA](http://iopa.io/iopa.png)](http://iopa.io)<br> iopa-tcp 

[![Build Status](https://api.shippable.com/projects/55f05c371895ca4474142e47/badge?branchName=master)](https://app.shippable.com/projects/55f05c371895ca4474142e47) 
[![IOPA](https://img.shields.io/badge/iopa-middleware-99cc33.svg?style=flat-square)](http://iopa.io)
[![limerun](https://img.shields.io/badge/limerun-certified-3399cc.svg?style=flat-square)](https://nodei.co/npm/limerun/)

[![NPM](https://nodei.co/npm/iopa-tcp.png?downloads=true)](https://nodei.co/npm/iopa-tcp/)

## About
`iopa-tcp` is an API-First Transport Control Protocol (TCP) stack for the Internet of Things (IoT), based on the Internet of Protocols Alliance (IOPA) specification  

It servers TCP messages in standard IOPA format and allows existing middleware for Connect, Express and limerun projects to consume/send each mesage.

It is an open-source, standards-based, lighter-weight replacement for other TCP clients and brokers 

Written in plain javascript for maximum portability to constrained devices, and consumes the standard node.js `require('net')` library

Makes TCP connections look to an application like a standard Request Response REST (HTTP-style) message so little or no application changes required to support multiple REST protocols on top of this transport.

## Status

Fully working prototype include server and client.

Includes:

### Server Functions

  * app.createServer
  * close
  
### Client Functions
  * connect
  
## Installation

    npm install iopa-tcp
    
## Install typings for Intellisense (e.g., Visual Studio Code, Sublime TSD plugins, etc.)

    npm run typings

## Example usage

```js
const iopa = require('iopa')
  , tcp = require('iopa-tcp')
 
var app = new iopa.App();

app.use(tcp);

app.use(function (context, next) {
  context["server.RawStream"].pipe(process.stdout);
  return next();
});

if (!process.env.PORT)
  process.env.PORT = 1883;

app.createServer("tcp:", { port: process.env.PORT, address: process.env.IP })

  .then(function (server) {
    return server.connect("mqtt://127.0.0.1");
  })
  
  .then(function (client) {
      client["server.RawStream"].write("Hello World\n");
    });
    
  })
 ```
 