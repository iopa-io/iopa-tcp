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
var iopa = require('iopa');
var net = require('net');
var util = require('util');
var events = require('events');
var TcpClient = require('./tcpClient.js');
var iopaStream = require('iopa-common-stream');

const constants = require('iopa').constants,
  IOPA = constants.IOPA,
  SERVER = constants.SERVER

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

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
function TcpServer(options, appFunc) {
  _classCallCheck(this, TcpServer);

  if (typeof options === 'function') {
    appFunc = options;
    options = {};
  }
  events.EventEmitter.call(this);

  options = options || {};
  this._options = options;
  this._factory = new iopa.Factory(options);
  this._appFunc = appFunc;

  this._connectFunc = this._appFunc.connect || function (context) { return Promise.resolve(context) };
  this._createFunc = this._appFunc.create || function (context) { return context };
  this._dispatchFunc = this._appFunc.dispatch || function (context) { return Promise.resolve(context) };

  this._tcpClient = new TcpClient(options, this._connectFunc, this._createFunc, this._dispatchFunc);

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
    return new Promise(function (resolve, reject) {
      reject("Already listening");
    });

  var that = this;

  this._tcp = net.createServer();
  this._tcp.on("connection", this._onConnection.bind(this));
  this._port = port;
  this._address = address;

  return new Promise(function (resolve, reject) {
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
Object.defineProperty(TcpServer.prototype, SERVER.LocalPort, { get: function () { return this._port; } });
Object.defineProperty(TcpServer.prototype, SERVER.LocalAddress, { get: function () { return this._address; } });
     
TcpServer.prototype._onConnection = function TcpServer_onConnection(socket) {
  var context = this._factory.createContext();
  var response = context.response;
 context[IOPA.Method] = IOPA.METHODS.connect;

  context[SERVER.TLS] = false;
  context[SERVER.RemoteAddress] = socket.remoteAddress;
  context[SERVER.RemotePort] = socket.remotePort;
  context[SERVER.LocalAddress] = this._address;
  context[SERVER.LocalPort] = this._port;
  context[SERVER.RawStream] = socket;
  context[SERVER.IsLocalOrigin] = false;
  context[SERVER.IsRequest] = true;
  context[SERVER.SessionId] = context[SERVER.LocalAddress] + ":" + context[SERVER.LocalPort] + "-" + context[SERVER.RemoteAddress] + ":" + context[SERVER.RemotePort];
  context.create = this._create.bind(this, context, response);
  context.dispatch = this._dispatchFunc;

  response[SERVER.TLS] = context[SERVER.TLS];
  response[SERVER.RemoteAddress] = context[SERVER.RemoteAddress];
  response[SERVER.RemotePort] = context[SERVER.RemotePort];
  response[SERVER.LocalAddress] = context[SERVER.LocalAddress];
  response[SERVER.LocalPort] = context[SERVER.LocalPort];
  response[SERVER.RawStream] = socket;
  response[SERVER.IsLocalOrigin] = true;
  response[SERVER.IsRequest] = false;
  var cancelToken = context[IOPA.CancelToken];
  socket.on("finish", this._onDisconnect.bind(this, context, cancelToken));
 
  this._connections[context[SERVER.SessionId]] = socket;
  var that = this;
   context.using(
     function(context){
      return that._appFunc(context)
       .then(function(){
         that._onDisconnect(context, cancelToken)
       })
     });
};

TcpServer.prototype._onDisconnect = function TcpServer_onDisconnect(context, canceltoken) {
  if (canceltoken.isCancelled)
    return;
    
  delete this._connections[context[SERVER.SessionId]];
  context[SERVER.CancelTokenSource].cancel(IOPA.EVENTS.Disconnect);
};

/**
 * Creates a new IOPA TCP Client Connection using URL host and port name
 *
 * @method connect
 * @param {string} urlStr url representation of Request://127.0.0.1:8002
 * @returns Promise<context>
 * @public
 */
TcpServer.prototype.connect = function TcpServer_connect(urlStr, defaults) {
  return this._tcpClient.connect(urlStr, defaults);
};

/**
 * Creates a new IOPA Request using a Tcp Url including host and port name
 *
 * @method create
 *
 * @param path string representation of ://127.0.0.1/hello
 * @param options object dictionary to override defaults
 * @returns context
 * @public
 */
TcpServer.prototype._create = function TcpServer_create(originalContext, originalResponse, path, options) {

  var urlStr = originalContext[IOPA.Scheme] +
    "//" +
    originalResponse[SERVER.RemoteAddress] + ":" + originalResponse[SERVER.RemotePort] +
    originalContext[IOPA.PathBase] +
    originalContext[IOPA.Path];

  if (path)
    urlStr += path;

  var context = originalContext[SERVER.Factory].createRequestResponse(urlStr, options);
  originalContext[SERVER.Factory].mergeCapabilities(context, originalContext);

  var response = context.response;
  
  context[SERVER.RawStream] = originalResponse[SERVER.RawStream];
  response[SERVER.RawStream] = originalContext[SERVER.RawStream];

  context[SERVER.LocalAddress] = originalContext[SERVER.LocalAddress];
  context[SERVER.LocalPort] = originalContext[SERVER.LocalPort];
  context[SERVER.SessionId] = originalContext[SERVER.SessionId];

  response[SERVER.LocalAddress] = context[SERVER.LocalAddress];
  response[SERVER.LocalPort] = context[SERVER.LocalPort];
  response[SERVER.SessionId] = context[SERVER.SessionId];

  var that = this;
  context.dispatch = function (dispose) {
    if (dispose)
      return that._dispatchFunc(context).then(context.dispose)
    else
      return that._dispatchFunc(context);
  }

  return this._createFunc(context);
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
  var self = this;
  var p = new Promise(function (resolve) {
    setTimeout(function () {
      self.emit("close");
      for (var key in this._connections)
        self._connections[key].destroy();
      self._tcp.close();
      self._tcpClient = undefined;
      self._tcp = undefined;
      self = null;
      resolve(null);
    }, 200)
  })

  return p;
};

module.exports = TcpServer;