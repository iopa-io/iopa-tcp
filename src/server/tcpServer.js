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
var iopaContextFactory = require('iopa').factory;
var net = require('net');
var util = require('util');
var events = require('events');
var TcpClient = require('./tcpClient.js');
var iopaStream = require('iopa-common-stream');

const constants = require('iopa').constants,
    IOPA = constants.IOPA,
    SERVER = constants.SERVER

/* *********************************************************
 * IOPA TCP SERVER (GENERIC)  
 * ********************************************************* */

/**
 * Representes TCP Server
 *
 * @class TcpServer
 * @param options (object)  {currently unusued}
 * @param appFunc (function(context))   delegate to which to call with all new inbound requests
 * @event request function(context)    alternative way to get inbound requests
 * @event error function(err, args)
 * @constructor
 * @public
 */
function TcpServer(options, serverPipeline) {
  if (typeof options === 'function') {
    serverPipeline = options;
    options = {};
  }

  this._options = options;

  if (serverPipeline) {
    this._appFunc = serverPipeline;
    this.on(IOPA.EVENTS.Request, this._invoke.bind(this));
  }

    this._tcpClient = new TcpClient(options);

  this._connections = {};
}

util.inherits(TcpServer, events.EventEmitter)

/**
 * @method listen
 * Create socket and bind to local port to listen for incoming requests
 *
 * @param {Integer} [port] Port on which to listen
 * @param {String} [address] Local host address on which to listen
 * @returns {Promise} 
 * @public
 */
TcpServer.prototype.listen = function TcpServer_listen(port, address) {

  if (port == undefined) {
    port = 0;
  }

  if (this._tcp)
    return new Promise(function(resolve, reject){
     reject("Already listening");
      });

  var that = this;

  this._tcp = net.createServer();
  this._tcp.on("connection", this._onConnection.bind(this));
  this._port = port;
  this._address = address;

  return new Promise(function(resolve, reject){
    that._tcp.listen(port, address || '0.0.0.0', 
      function () {
        that._linfo = that._tcp.address();
        that._port = that._linfo.port;
        that._address = that._linfo.address;
        resolve(that._linfo);
      });
  });
};

Object.defineProperty(TcpServer.prototype, "port", { get: function () { return this._port; } });
Object.defineProperty(TcpServer.prototype, "address", { get: function () { return this._address; } });

TcpServer.prototype._onConnection = function TcpServer_onConnection(socket) {
  var context = iopaContextFactory.createContext();
  context[IOPA.Method] = "TCP-CONNECT";

  context[SERVER.TLS] = false;
  context[SERVER.RemoteAddress] = socket.remoteAddress;
  context[SERVER.RemotePort] = socket.remotePort;
  context[SERVER.LocalAddress] = this._address;
  context[SERVER.LocalPort] = this._port;
  context[SERVER.RawStream] = socket;
  context[SERVER.IsLocalOrigin] = false;
  context[SERVER.IsRequest] = true;
  context[SERVER.SessionId] = socket.remoteAddress + ':' + socket.remotePort;

  var response = context.response;
  response[SERVER.TLS] = context["server.TLS"];
  response[SERVER.RemoteAddress] = context["server.RemoteAddress"];
  response[SERVER.RemotePort] = context["server.RemotePort"];
  response[SERVER.LocalAddress] = context["server.LocalAddress"];
  response[SERVER.LocalPort] = context["server.LocalPort"];
  response[SERVER.RawStream] = context["server.RawStream"];
  response[SERVER.IsLocalOrigin] = true;
  response[SERVER.IsRequest] = false;
  socket.once("close", this._onDisconnect.bind(this, context));

  this._connections[context[SERVER.SessionId]] = socket;
  this.emit(IOPA.EVENTS.Request, context);
};

TcpServer.prototype._onDisconnect = function TcpServer_onDisconnect(context) {
  delete this._connections[context[SERVER.SessionId]];
 
  setTimeout(function () {
    iopaContextFactory.dispose(context);
  }, 1000);

  if (context[IOPA.Events]) {
    context[IOPA.Events].emit(IOPA.EVENTS.Disconnect);
    context[SERVER.CallCancelledSource].cancel(IOPA.EVENTS.Disconnect);
  }
};

TcpServer.prototype._invoke = function TcpServer_invoke(context) {
  context[SERVER.Fetch] = this.requestResponseFetch.bind(this, context);
  return iopaContextFactory.using(context, this._appFunc);
};

/**
 * Creates a new IOPA TCP Client Connection using URL host and port name
 *
 * @method connect
 * @param {string} urlStr url representation of Request://127.0.0.1:8002
 * @returns Promise<context>
 * @public
 */
TcpServer.prototype.connect = function TcpServer_connect(urlStr) {
  return this._tcpClient.connect(urlStr);
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
TcpServer.prototype.requestResponseFetch = function TcpServer_requestResponseFetch(originalContext, path, options, pipeline) {
  if (typeof options === 'function') {
    pipeline = options;
    options = {};
  }
  
  var urlStr = originalContext[IOPA.Scheme] +
    "://" +
    originalContext[SERVER.RemoteAddress] + ":" + originalContext[SERVER.RemotePort] +
    originalContext[IOPA.PathBase] +
    originalContext[IOPA.Path] + path;

  var context = iopaContextFactory.createRequest(urlStr, options);

 //REVERSE STREAMS SINCE SENDING REQUEST (e.g., PUBLISH) BACK ON RESPONSE CHANNEL
  context[SERVER.RawStream] = originalContext.response[SERVER.RawStream];
  context[SERVER.IsLocalOrigin] = true;
  context[SERVER.IsRequest] = false;
   
  return iopaContextFactory.using(context, pipeline);
};

/**
 * @method close
 * Close the underlying socket and stop listening for data on it.
 * 
 * @returns {Promise()}
 * @public
 */
TcpServer.prototype.close = function TcpServer_close() {
  if (this._tcpClient)
    this._tcpClient.close();

  for (var key in this._connections)
    this._connections[key].destroy();


  this._tcp.close();
  this._tcpClient = undefined;
  this._tcp = undefined;
  return Promise.resolve(null);
};

module.exports = TcpServer;