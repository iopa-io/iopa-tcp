# [![IOPA](http://iopa.io/iopa.png)](http://iopa.io) iopa-tcp 

[![Build Status](https://api.shippable.com/projects/55986ca7edd7f2c05258f2e6/badge?branchName=master)](https://app.shippable.com/projects/55986ca7edd7f2c05258f2e6) 
[![IOPA](https://img.shields.io/badge/iopa-middleware-99cc33.svg?style=flat-square)](http://iopa.io)
[![limerun](https://img.shields.io/badge/limerun-certified-3399cc.svg?style=flat-square)](https://nodei.co/npm/limerun/)

[![NPM](https://nodei.co/npm/iopa-tcp.png?downloads=true)](https://nodei.co/npm/iopa-tcp/)

## About
`iopa-tcp` is a lightweight TCP server, based on the Internet of Protocols Alliance (IOPA) open standard  

It servers TCP messages in standard IOPA format and allows existing middleware for Connect, Express and limerun projects to consume/send each mesage.

It is an open-source, standards-based, lighter-weight replacement for other TCP clients and brokers 

Written in plain javascript for maximum portability to constrained devices, and consumes the standard node.js `require('net')` library

Makes TCP connections look to an application like a standard Request Response REST (HTTP-style) message so little or no application changes required to support multiple REST protocols on top of this transport.

## Status

Fully working prototype include server and client.

Includes:

### Server Functions

  * listen
  * close
  
### Client Functions
  * connect
  
## Installation

    npm install iopa-tcp

 