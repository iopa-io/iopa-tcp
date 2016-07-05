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

const iopa = require('iopa-rest'),
  net = require('net'),
  constants = iopa.constants,
  IOPA = constants.IOPA,
  SERVER = constants.SERVER

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Representes TCP Server
 *
 * @class TcpServer
 * @param app  IOPA AppBuilder App
 * @event error function(err, args)
 * @constructor
 * @public
 */
function TcpServer(app) {
  _classCallCheck(this, TcpServer);

  this._app = app;

  const packageVersion = require('../../package.json').version;

  app.properties[SERVER.Capabilities][IOPA.CAPABILITIES.Tcp] = {};
  app.properties[SERVER.Capabilities][IOPA.CAPABILITIES.Tcp][SERVER.Version] = packageVersion;

  app.createServer = this.createServer_.bind(this, app.createServer || function () { throw new Error("no registered transport provider"); });
}

/**
 * @method listen
 * Create socket and bind to local port to listen for incoming requests
 *
 * @param {Object} Options dictionary that includes port num, address string
 * @returns {Promise} 
 * @public
 */
TcpServer.prototype.createServer_ = function TcpServer_createServer(next, scheme, options) {
  if (scheme != "tcp:")
    return next(scheme, options)

  options = options || {};

  if (!this._app.properties[SERVER.IsBuilt])
    this._app.build();
  var server = {};

  server._tcp = net.createServer();
  server._connections = {};
  server.listen = this.listen_.bind(this, server);
  server.connect = function (url) {
    return this._app.dispatch(
      this._app.createContext(url,
        {
          "response": true,
          [IOPA.Method]: IOPA.METHODS.connect
        }
      ));
  }.bind(this);
  server.close = this.close_.bind(this, server);

  server._tcp.on("connection", this._onConnection.bind(this, server));

  return server;
};

/**
 * @method listen_
 * Create socket and bind to local port to listen for incoming requests
 *
 * @param {Object} Options dictionary that includes port num, address string
 * @returns {Promise} 
 * @public
 */
TcpServer.prototype.listen_ = function TcpServer_listen(server, options) {
  options = options || {};

  var port = options.port || options[IOPA.LocalPort] || 0;
  var address = options.address || options[IOPA.LocalAddress] || '0.0.0.0';

  server.port = port;
  server.address = address;

  return new Promise(function (resolve, reject) {
    server._tcp.listen(server.port, server.address,
      function () {
        var linfo = server._tcp.address();
        server.port = linfo.port;
        server.address = linfo.address;
        resolve(server);
      });
  });
};

TcpServer.prototype._onConnection = function TcpServer_onConnection(server, socket) {
  var context = this._app.Factory.createContext();
  var response = context.addResponse();
  context[IOPA.Method] = IOPA.METHODS.connect;

  context[SERVER.TLS] = false;
  context[SERVER.RemoteAddress] = socket.remoteAddress;
  context[SERVER.RemotePort] = socket.remotePort;
  context[SERVER.LocalAddress] = server.address;
  context[SERVER.LocalPort] = server.port;
  context[SERVER.RawStream] = socket;
  context[SERVER.RawTransport] = socket;
  context[SERVER.IsLocalOrigin] = false;
  context[SERVER.IsRequest] = true;
  context[SERVER.SessionId] = context[SERVER.LocalAddress] + ":" + context[SERVER.LocalPort] + "-" + context[SERVER.RemoteAddress] + ":" + context[SERVER.RemotePort];

  response[SERVER.TLS] = context[SERVER.TLS];
  response[SERVER.RemoteAddress] = context[SERVER.RemoteAddress];
  response[SERVER.RemotePort] = context[SERVER.RemotePort];
  response[SERVER.LocalAddress] = context[SERVER.LocalAddress];
  response[SERVER.LocalPort] = context[SERVER.LocalPort];
  response[SERVER.RawStream] = socket;
  response[SERVER.IsLocalOrigin] = true;
  response[SERVER.IsRequest] = false;
  var cancelToken = context[SERVER.CancelToken];
  socket.on("finish", this._onDisconnect.bind(this, server, context, cancelToken));

  server._connections[context[SERVER.SessionId]] = socket;
  var that = this;
  context.using(
    function (context) {
      return that._app.invoke(context)
        .then(function () {
          that._onDisconnect(server, context, cancelToken)
        })
    });
};

TcpServer.prototype._onDisconnect = function TcpServer_onDisconnect(server, context, canceltoken) {
  if (canceltoken.isCancelled)
    return;

  delete server._connections[context[SERVER.SessionId]];
  context[SERVER.CancelTokenSource].cancel(IOPA.EVENTS.Disconnect);
};

/**
 * @method close
 * Close the underlying socket and stop listening for data on it.
 * 
 * @returns {Promise()}
 * @public
 */
TcpServer.prototype.close_ = function TcpServer_close(server) {
  return new Promise(function (resolve) {
    setTimeout(function () {
      for (var key in server._connections)
        server._connections[key].destroy();
      server._tcp.close();
      server._tcp = undefined;
      server = null;
      resolve(null);
    }, 200)
  });
};

module.exports = TcpServer;