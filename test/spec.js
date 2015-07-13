/*
 * Copyright (c) 2015 Limerun Project Contributors
 * Portions Copyright (c) 2015 Internet of Protocols Assocation (IOPA)
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
 
const iopa = require('iopa')
    , TcpServer = require('../src/tcpServer.js')
    , Promise = require('bluebird')
    , util = require('util')
    , Events = require('events')
    , BufferList = require('bl');
    
var should = require('should');

describe('#TCPServer()', function() {
       var server;
       var events = new Events.EventEmitter();
       var data = new BufferList();
        
      before(function(done){
        //  serverPipeline 
          var serverChannelApp = new iopa.App();
          serverChannelApp.use(function(channelContext, next){
            channelContext["server.RawStream"].on("data", function(chunk){
               events.emit("data", chunk);
               data.append(chunk);
            });
             channelContext["server.RawStream"].on("end", function(){
               events.emit("end", data);
            });
            return next();  
          });
          var serverPipeline = serverChannelApp.build();
         
          //clientChannelPipeline 
          var clientChannelApp = new iopa.App();
          var clientPipeline = clientChannelApp.build();
        
          server = new TcpServer({}, serverPipeline, clientPipeline);
  
         if (!process.env.PORT)
          process.env.PORT = 1883;
          
        server.listen(process.env.PORT, process.env.IP)
          .then(function(){
           done();
           });
 
      });
      
    it('server should listen', function() {
        console.log("Server is on port " + server.port );
    });
    
    it('client should connect and server should receive client packets', function(done) {
        server.connect("mqtt://127.0.0.1")
       .then(function(client){
        console.log("Client is on port " + client["server.LocalPort"]);
        var context = client["server.createRequest"]("/", "GET");
        events.on("end", function(data){
          data.toString().should.equal('Hello World');
          done();
        })
        context["iopa.Body"].pipe(context["server.RawStream"] );
        context["iopa.Body"].write("Hello ");
        context["iopa.Body"].end("World");
        return null;
       })
    });
});
