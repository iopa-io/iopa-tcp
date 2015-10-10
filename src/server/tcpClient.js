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
 
  iopaStream = require('iopa-common-stream'),
  iopa = require('iopa'),
  IOPA = iopa.constants.IOPA,
  SERVER = iopa.constants.SERVER

/* *********************************************************
 * IOPA TCP CLIENT (GENERIC)  
 * ********************************************************* */
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
* Creates a new IOPA Request using a Tcp Url including host and port name
*
* @method TcpClient

* @parm {object} options not used
* @parm {string} urlStr url representation of ://127.0.0.1:8200
* @public
* @constructor
*/
function TcpClient(options, appFuncConnect, appFuncCreate, appFuncDispatch) {
  
  _classCallCheck(this, TcpClient);

  if (typeof options === 'function') {
    appFuncDispatch = appFuncConnect;
    appFuncConnect = options;
    options = {};
  }
  
  events.EventEmitter.call(this);

  this._connectFunc = appFuncConnect || function(context){return Promise.resolve(context)};
  this._createFunc = appFuncCreate || function (context) { return context };
   this._dispatchFunc = appFuncDispatch || function(context){return Promise.resolve(context)};
 
  this._options = options;
  this._factory = new iopa.Factory(options);
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
TcpClient.prototype.connect = function TcpClient_connect(urlStr, defaults) {
 defaults = defaults || {};
 defaults[IOPA.Method] = defaults[IOPA.Method] || IOPA.METHODS.connect;
  var channelContext = this._factory.createRequestResponse(urlStr, defaults);
  var channelResponse = channelContext.response;

  channelContext.create = this._create.bind(this, channelContext, channelContext.response);
  channelContext.dispatch = this._dispatchFunc;
  channelContext.disconnect = this._disconnect.bind(this, channelContext);

  var that = this;
  return new Promise(function (resolve, reject) {
    var socket = net.createConnection(
      channelContext[SERVER.RemotePort],
      channelContext[SERVER.RemoteAddress],
      function () {
        channelContext[SERVER.RawStream] = socket;
        channelContext[SERVER.RawTransport] = socket;
        channelContext[SERVER.LocalAddress] = socket.localAddress;
        channelContext[SERVER.LocalPort] = socket.localPort;
        
        channelResponse[SERVER.RawStream] = socket;
        channelResponse[SERVER.RawTransport] = socket;
        channelResponse[SERVER.LocalAddress] = channelContext[SERVER.LocalAddress];
        channelResponse[SERVER.LocalPort] = channelContext[SERVER.LocalPort];
        
        socket.once('finish', that._disconnect.bind(that, channelContext, null));
        socket.once('error', that._disconnect.bind(that, channelContext));
        channelContext[SERVER.SessionId] = channelContext[SERVER.LocalAddress] + ":" + channelContext[SERVER.LocalPort] + "-" + channelContext[SERVER.RemoteAddress] + ":" + channelContext[SERVER.RemotePort];
        that._connections[channelContext[SERVER.SessionId]] = channelContext;
        resolve(that._connectFunc(channelContext));
      });
  });
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
TcpClient.prototype._create = function TcpClient_create(originalContext, originalResponse, path, options) {

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
  
  context[SERVER.RawStream] = originalContext[SERVER.RawStream];
  response[SERVER.RawStream] = originalResponse[SERVER.RawStream];

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
 * Close the  channel context
 * 
 * @public
 */
TcpClient.prototype._disconnect = function TcpClient_disconnect(channelContext, err) {
  if (channelContext[IOPA.CancelToken].isCancelled)
     return;
     
  channelContext[IOPA.Events] = null;
  channelContext[SERVER.CancelTokenSource].cancel(IOPA.EVENTS.Disconnect);
  delete this._connections[channelContext[SERVER.SessionId]];
  setTimeout(function(){
      channelContext[SERVER.RawTransport].destroy();
       channelContext.dispose();
  }, 100);
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

  return new Promise(function (resolve) {
    setTimeout(function () {
      resolve(null);
    }, 200);
  });

};

module.exports = TcpClient;