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

var iopaContextFactory = require('iopa').factory;
 
/*
* bluebird version only -- not used
*
* exports = function using(context, cb){
* 	 return Promise.using(Promise.resolve(context)
*	 .disposer(function(context, promise){
*		 iopaContextFactory.dispose(context);
*		 context = null; 
*	 }), cb);
* }
*/
 
/*
* ES6 finally/dispose pattern for IOPA Context
* @param context Iopa
* @param callback function(context): Promise
* returns Promise that always ultimately resolves to callback's result or rejects
*/
module.exports = function using(context, callback) {

	return new Promise(function (resolve, reject) {

		var v = callback(context);

		if (typeof v === 'undefined')
			v = null;

		resolve(v);

	}).then(function (value) {
		return Promise.resolve(function () {

			iopaContextFactory.dispose(context);
			context = null;
			return value;

		} ());
	},
		function (err) {

			context.log.error(err);
			iopaContextFactory.dispose(context);
			context = null;
			throw err;

		});
};