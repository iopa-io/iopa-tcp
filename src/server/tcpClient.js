/*
 * Copyright (c) 2015 Internet of Protocols Alliance (IOPA)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// DEPENDENCIES
const net = require('net'),
  util = require('util'),
  events = require('events'),
 
  using = require('../util/using.js'),

  iopaStream = require('iopa-common-stream'),
  iopaContextFactory = require('iopa').factory,
  constants = require('iopa').constants,
  IOPA = constants.IOPA,
  SERVER = constants.SERVER,
  METHODS = constants.METHODS,
  PORTS = constants.PORTS,
  SCHEMES = constants.SCHEMES,
  PROTOCOLS = constants.PROTOCOLS,
  IOPAEVENTS = constants.EVENTS,
  APP = constants.APP,
  COMMONKEYS = constants.COMMONKEYS,
  OPAQUE = constants.OPAQUE,
  WEBSOCKET = constants.WEBSOCKET,
  SECURITY = constants.SECURITY;

/* *********************************************************
 * IOPA TCP CLIENT (GENERIC)  
 * ********************************************************* */

/**
* Creates a new IOPA Request using a Tcp Url including host and port name
*
* @method TcpClient

* @parm {object} options not used
* @parm {string} urlStr url representation of ://127.0.0.1:8200
* @public
* @constructor
*/
function TcpClient(options) {
  events.EventEmitter.call(this);

  this._options = options;
  this._connections = {};
}

util.inherits(TcpClient, events.EventEmitter);

/**
* Creates a new IOPA Request using a Tcp Url including host and port name
*
* @method connect

* @parm {object} options not used
* @parm {string} urlStr url representation of ://127.0.0.1:8200
* @public
* @constructor
*/
TcpClient.prototype.connect = function TcpClient_connect(urlStr) {
  var channelContext = iopaContextFactory.createRequest(urlStr, "TCP-CONNECT");
  channelContext[SERVER.OriginalUrl] = urlStr;
  channelContext[SERVER.Fetch] = TcpClient_Fetch.bind(this, channelContext);
  channelContext[SERVER.IsLocalOrigin] = true;
  channelContext[SERVER.IsRequest] = true;
  channelContext[IOPA.MessageId] = channelContext[IOPA.Seq];

  var that = this;
  return new Promise(function (resolve, reject) {
    var socket = net.createConnection(
      channelContext[SERVER.RemotePort],
      channelContext[SERVER.RemoteAddress],
      function () {
        channelContext[SERVER.RawStream] = socket;
        channelContext[SERVER.LocalAddress] = socket.localAddress;
        channelContext[SERVER.LocalPort] = socket.localPort;
        socket.once('finish', that._disconnect.bind(that, channelContext, null));
        socket.once('error', that._disconnect.bind(that, channelContext));
        channelContext[IOPA.Body] = new iopaStream.OutgoingNoPayloadStream();
        channelContext[SERVER.SessionId] = channelContext[SERVER.LocalAddress] + ":" + channelContext[SERVER.LocalPort] + "-" + channelContext[SERVER.RemoteAddress] + ":" + channelContext[SERVER.RemotePort];

        that._connections[channelContext[SERVER.SessionId]] = channelContext;
        resolve(channelContext);
      });
  });
};
 
/**
 * Fetches a new IOPA Request using a Tcp Url including host and port name
 *
 * @method fetch

 * @param path string representation of ://127.0.0.1/hello
 * @param options object dictionary to override defaults
 * @param pipeline function(context):Promise  to call with context record
 * @returns Promise<null>
 * @public
 */
function TcpClient_Fetch(channelContext, path, options, pipeline) {
  if (typeof options === 'function') {
    pipeline = options;
    options = {};
  }
  
  var urlStr = channelContext[SERVER.OriginalUrl] + path;
  var context = iopaContextFactory.createRequest(urlStr, options);

  context[SERVER.TLS] = channelContext[SERVER.TLS];
  context[SERVER.RemoteAddress] = channelContext[SERVER.RemoteAddress] ;
  context[SERVER.RemotePort] = channelContext[SERVER.RemotePort];
  context[SERVER.LocalAddress] = channelContext[SERVER.LocalAddress];
  context[SERVER.LocalPort] = channelContext[SERVER.LocalPort];
  context[SERVER.RawStream] = channelContext[SERVER.RawStream];
  context[SERVER.SessionId] = channelContext[SERVER.SessionId];
  context[SERVER.IsLocalOrigin] = true;
  context[SERVER.IsRequest] = true;
  
  return using(context, pipeline);
};

/**
 * @method close
 * Close the  channel context
 * 
 * @public
 */
TcpClient.prototype._disconnect = function TcpClient_disconnect(channelContext, err) {
  channelContext[IOPA.Events].emit(IOPAEVENTS.Disconnect);
  channelContext[SERVER.CallCancelledSource].cancel(IOPAEVENTS.Disconnect);
  channelContext[SERVER.RawStream].destroy();
  delete this._connections[channelContext[SERVER.SessionId]];
  iopaContextFactory.dispose(channelContext);
}

/**
 * @method close
 * Close all the underlying sockets
 * 
 * @returns {Promise()}
 * @public
 */
TcpClient.prototype.close = function TcpClient_close() {
  for (var key in this._connections)
    this._disconnect(this._connections[key], null);

  this._connections = {};

  return Promise.resolve(null);
};

module.exports = TcpClient;