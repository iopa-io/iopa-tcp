/*
 * Copyright (c) 2016 Internet of Protocols Alliance (IOPA)
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

const net = require('net'),
  iopa = require('iopa-rest'),
  iopaStream = require('iopa-common-stream'),
  IOPA = iopa.constants.IOPA,
  SERVER = iopa.constants.SERVER

  const packageVersion = require('../../package.json').version;

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
function TcpClient(app) {

  _classCallCheck(this, TcpClient);
  var client = this;
  client._connections = {};

  app.properties[SERVER.Capabilities][IOPA.CAPABILITIES.Tcp] = {};
  app.properties[SERVER.Capabilities][IOPA.CAPABILITIES.Tcp][SERVER.Version] = packageVersion;
 
  app.createContext = this.createContext.bind(this, app.createContext.bind(app));
}


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
TcpClient.prototype.createContext = function IopaTCP_create(next, urlStr) {
  var context = next(urlStr);
  var response = context.response;
  context[SERVER.RawStream] = new iopaStream.OutgoingStream();
  response[SERVER.RawStream] = new iopaStream.IncomingStream();
  return context;
};

/**
* Dispatches a Tcp Request 
*
* @method dispatch

* @parm {object} options not used
* @parm {string} urlStr url representation of ://127.0.0.1:8200
* @public
* @constructor
*/
TcpClient.prototype.dispatch = function TcpClient_dispatch(channelContext, next) {
  var client = this;
  var self = this;

  return new Promise(function (resolve, reject) {
    var socket = net.createConnection(
      channelContext[SERVER.RemotePort],
      channelContext[SERVER.RemoteAddress],
      function () {
        channelContext[SERVER.RawStream].pipe(socket);
        channelContext[SERVER.RawTransport] = socket;
        channelContext[SERVER.LocalAddress] = socket.localAddress;
        channelContext[SERVER.LocalPort] = socket.localPort;

        socket.pipe(channelContext.response[SERVER.RawStream], { end: false });
        channelContext.response[SERVER.LocalAddress] = socket.localAddress;
        channelContext.response[SERVER.LocalPort] = socket.localPort;

        channelContext[SERVER.RawStream].once('error', function (err) { socket.end(); })
        socket.once('finish', self._onDisconnect.bind(self, client, channelContext, null));
        socket.once('error', self._onDisconnect.bind(self, client, channelContext));
        channelContext[SERVER.SessionId] = channelContext[SERVER.LocalAddress] + ":" + channelContext[SERVER.LocalPort] + "-" + channelContext[SERVER.RemoteAddress] + ":" + channelContext[SERVER.RemotePort];
        client._connections[channelContext[SERVER.SessionId]] = channelContext;
        resolve(channelContext);
      });
  });

   //ignore next
};

/**
 * @method _onDisconnect
 * Called when a TCP channel connection is disconnected
 * 
 * @public
 */
TcpClient.prototype._onDisconnect = function TcpClient_onDisconnect(client, channelContext, err) {
  if (channelContext[SERVER.CancelToken].isCancelled)
    return;

  channelContext[IOPA.Events] = null;
  channelContext[SERVER.CancelTokenSource].cancel(IOPA.EVENTS.Disconnect);
  delete client._connections[channelContext[SERVER.SessionId]];
  setTimeout(function () {
    channelContext[SERVER.RawTransport].destroy();
    channelContext.dispose();
  }, 100);
}

/**
 * @method _onClose
 * Close the underlying client sockets and stop listening for data
 * 
 * @returns {Promise()}
 * @public
 */
TcpClient.prototype._onClose = function TcpClient_onClose(client) {
  for (var key in client._connections)
    this._disconnect(client._connections[key], null);

  client._connections = {};

  return new Promise(function (resolve) {
    setTimeout(function () {
      resolve(null);
    }, 200);
  });
};

module.exports = TcpClient;