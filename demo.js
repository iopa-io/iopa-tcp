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

// global.Promise = require('bluebird');

const iopa = require('iopa'),
  iopaStream = require('iopa-common-stream'),
  tcp = require('./index.js')

var app = new iopa.App();
app.use(tcp);

app.use(function (channelContext, next) {
  channelContext["server.RawStream"].pipe(process.stdout);
  return next();
});

app.use("dispatch", function (context, next) {
  return next().then(function () {
    context[IOPA.Body].pipe(context["server.RawStream"]);
    return context;
  })
});

 app.createContext = (function IopaTCP_create(next, urlStr) {
  var context = next(urlStr);
  context[IOPA.Body] = new iopaStream.OutgoingStream();
  return context;
}).bind(this, app.createContext.bind(app));

app.build();

if (!process.env.PORT)
  process.env.PORT = 1883;

var _server;
app.createServer("tcp:", { port: process.env.PORT, address: process.env.IP })
  .then(function (server) {
    _server = server;
    console.log("Server Started on port " + server.port);
    return server.connect("mqtt://127.0.0.1");
  })
  .then(function (client) {
    console.log("Client is on port " + client["server.LocalPort"]);
    client.end("Hello World\n");
    setTimeout(_server.close, 200);
  }) 



