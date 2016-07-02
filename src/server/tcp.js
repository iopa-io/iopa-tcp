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

// DEPENDENCIES
var TcpServer = require('./tcpServer.js');
var TcpClient = require('./tcpClient.js');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/* *********************************************************
 * IOPA TCP MIDDLEWARE
 * ********************************************************* */

/**
 * Representes TCP Server
 *
 * @class IopaTCP Server
 * @param app The IOPA AppBuilder dictionary
 * @constructor
 * @public
 */
function IopaTCP(app) {
  _classCallCheck(this, IopaTCP);

  app.use(TcpClient);
  app.use(TcpServer);
}

module.exports = IopaTCP;