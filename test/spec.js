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
 
const iopa = require('iopa')
    , tcp = require('../index.js')
    , util = require('util')
    , Events = require('events')
    , BufferList = require('bl')
    
var should = require('should');

describe('#TCPServer()', function() {
       var server;
       var events = new Events.EventEmitter();
       var data = new BufferList();
        
       before(function(done){
          var serverChannelApp = new iopa.App();
          serverChannelApp.use(function(channelContext, next){
            channelContext["server.RawStream"].on("data", function(chunk){
               events.emit("test.Data", chunk);
               data.append(chunk);
            });
             channelContext["server.RawStream"].on("end", function(){
               events.emit("test.Finish", data);
            });
            return next();  
          });
          var serverPipeline = serverChannelApp.build();
         
         server = tcp.createServer({}, serverPipeline);
  
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
    
    it('client should connect and server should receive client packets', function (done) {
        server.connect("mqtt://127.0.0.1")
            .then(function (client) {
                console.log("Client is on port " + client["server.LocalPort"]);
                events.on("test.Finish", function (data) {
                    data.toString().should.equal('Hello World');
                    done();
                });
                client.fetch("/",
                    { "iopa.Method": "GET", "iopa.Body": new BufferList() },
                    function (context) {
                        try{
                        context["iopa.Body"].pipe(context["server.RawStream"]);
                        context["iopa.Body"].write("Hello ");
                        context["iopa.Body"].end("World");
                        } catch (ex) {
                            console.log(ex);
                            return Promise.reject(ex);
                        }
                    });
            })
    });
    
    it('server should close', function(done) {
        server.close();
        process.nextTick(done);
    });
    
    it('client disconnects, server should also close', function (done) {
        var server2;

        var serverChannelApp = new iopa.App();
        serverChannelApp.use(function (channelContext, next) {

            channelContext["iopa.CallCancelled"].onCancelled(
                function (reason) {
                    reason.code.should.equal('OperationCancelled');
                    done();
                    channelContext["test.SessionClose"]();
                    server2.close();
                });

            return next().then(function () {
                return new Promise(function (resolve, reject) {
                    channelContext["test.SessionClose"] = resolve;
                    channelContext["test.SessionError"] = reject;
                });
            });
        });
        
        var serverPipeline = serverChannelApp.build();

        server2 = tcp.createServer({}, serverPipeline);

        if (!process.env.PORT)
            process.env.PORT = 1883;

        server2.listen(process.env.PORT, process.env.IP)
          .then(function(){
                return server2.connect("mqtt://127.0.0.1")
              })
          .then(function(client){
                 client.fetch("/",
                    { "iopa.Method": "GET", "iopa.Body": new BufferList() },
                    function (context) {
                       context["iopa.Body"].pipe(context["server.RawStream"]);
                        context["iopa.Body"].end("");
                    });
                });
    });   
    
    it('server disconnects, client should also close', function(done) {
      
          //serverPipeline 
          var serverChannelApp = new iopa.App();
          serverChannelApp.use(function(channelContext, next){
              return next().then(function(){ return new Promise(function(resolve, reject){
                 channelContext["mqttPacketServer.SessionClose"] = resolve;
                 channelContext["mqttPacketServer.SessionError"] = reject;
                }); 
            });
          });

          var serverPipeline = serverChannelApp.build();
         
          var server3 = tcp.createServer({}, serverPipeline);
  
         if (!process.env.PORT)
           process.env.PORT = 1883;
          
        server3.listen(process.env.PORT, process.env.IP)
          .then(function(){
                return server3.connect("mqtt://127.0.0.1")
              })
          .then(function(client){
             client["iopa.CallCancelled"].onCancelled(function(reason){ 
               reason.code.should.equal('OperationCancelled');
               done();
              });
            
              server3.close();
              return null;
          });
    });
    
});
