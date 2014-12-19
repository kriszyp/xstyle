define('xstyle/core/es6', [], function(){
	var hasFeatures = {
		observe: Object.observe,
		defineProperty: Object.defineProperty && (function(){
			try{
				Object.defineProperty({}, 't', {});
				return true;
			}catch(e){
			}
		})(),
		promise: typeof Promise !== 'undefined'
	};
	function has(feature){
		return hasFeatures[feature];
	}
	// This is an polyfill for Object.observe with just enough functionality
	// for what xstyle needs
	// An observe function, with polyfile
	var observe = has('observe') ? Object.observe :
		// for the case of setter support, but no Object.observe support (like IE9, IE10, some FF, Safari)
		// this is much faster than polling
			has('defineProperty') ? 
		function observe(target, listener){
			/*for(var i in target){
				addKey(i);
			}*/
			listener.addKey = addKey;
			listener.remove = function(){
				listener = null;
			};
			function addKey(key){
				var keyFlag = 'key' + key;
				if(this[keyFlag]){
					return;
				}else{
					this[keyFlag] = true;
				}
				var currentValue = target[key];
				var descriptor = Object.getOwnPropertyDescriptor(target, key);
				if(descriptor && descriptor.set){
					var previousSet = descriptor.set;
					var previousGet = descriptor.get;
					Object.defineProperty(target, key, {
						get: function(){
							return (currentValue = previousGet.call(this));
						},
						set: function(value){
							previousSet.call(this, value);
							if(currentValue !== value){
								currentValue = value;
								if(listener){
									queue(listener, this, key);
								}
							}
						}
					});
				}else{
					Object.defineProperty(target, key, {
						get: function(){
							return currentValue;
						},
						set: function(value){
							if(currentValue !== value){
								currentValue = value;
								if(listener){
									queue(listener, this, key);
								}
							}
						}
					});
				}
			}
		} :
		// and finally a polling-based solution, for the really old browsers
		function(target, listener){
			if(!timerStarted){
				timerStarted = true;
				setInterval(function(){
					for(var i = 0, l = watchedObjects.length; i < l; i++){
						diff(watchedCopies[i], watchedObjects[i], listeners[i]);
					}
				}, 20);
			}
			var copy = {};
			for(var i in target){
				if(target.hasOwnProperty(i)){
					copy[i] = target[i];
				}
			}
			watchedObjects.push(target);
			watchedCopies.push(copy);
			listeners.push(listener);
		};
	var queuedListeners;
	function queue(listener, object, name){
		if(queuedListeners){
			if(queuedListeners.indexOf(listener) === -1){
				queuedListeners.push(listener);
			}
		}else{
			queuedListeners = [listener];
			setTimeout(function(){
				queuedListeners.forEach(function(listener){
					var events = [];
					listener.properties.forEach(function(property){
						events.push({target: listener.object, name: property});
					});
					listener(events);
					listener.object = null;
					listener.properties = null;
				});
				queuedListeners = null;
			}, 0);
		}
		listener.object = object;
		var properties = listener.properties || (listener.properties = []);
		if(properties.indexOf(name) === -1){
			properties.push(name);
		}
	}
	var unobserve = has('observe') ? Object.unobserve :
		function(target, listener){
			if(listener.remove){
				listener.remove();
			}
			for(var i = 0, l = watchedObjects.length; i < l; i++){
				if(watchedObjects[i] === target && listeners[i] === listener){
					watchedObjects.splice(i, 1);
					watchedCopies.splice(i, 1);
					listeners.splice(i, 1);
					return;
				}
			}
		};
	var watchedObjects = [];
	var watchedCopies = [];
	var listeners = [];
	var timerStarted = false;
	function diff(previous, current, callback){
		// TODO: keep an array of properties for each watch for faster iteration
		var queued;
		for(var i in previous){
			if(previous.hasOwnProperty(i) && previous[i] !== current[i]){
				// a property has changed
				previous[i] = current[i];
				(queued || (queued = [])).push({name: i});
			}
		}
		for(var i in current){
			if(current.hasOwnProperty(i) && !previous.hasOwnProperty(i)){
				// a property has been added
				previous[i] = current[i];
				(queued || (queued = [])).push({name: i});
			}
		}
		if(queued){
			callback(queued);
		}
	}
	if(!has('promise')){
		var PromisePolyFill = function(execute){
			var isResolved, resolution, errorResolution;
			var queue = 0;
			function resolve(value){
				// resolve function
				if(value.then){
					// received a promise, wait for it
					value.then(resolve, reject);
				}else{
					resolution = value;
					finished();
				}
			}
			function reject(error){
				// reject function
				errorResolution = error;
				finished();
			}
			execute(resolve, reject);
			function finished(){
				isResolved = true;
				for(var i = 0, l = queue.length; i < l; i++){
					queue[i]();
				}
				// clean out the memory
				queue = 0;
			}
			return {
				then: function(callback, errback){
					return new PromisePolyFill(function(resolve, reject){
						function handle(){
							// promise fulfilled, call the appropriate callback
							try{
								if(errorResolution && !errback){
									// errors without a handler flow through
									reject(errorResolution);
								}else{
									// resolve to the callback's result
									resolve(errorResolution ?
										errback(errorResolution) :
										callback ?
											callback(resolution) : resolution);
								}
							}catch(newError){
								// caught an error, reject the returned promise
								reject(newError);
							}
						}
						if(isResolved){
							// already resolved, immediately handle
							handle();
						}else{
							(queue || (queue = [])).push(handle);
						}
					});
				}
			};
		};
	}
	return {
		Promise: has('promise') ? Promise : PromisePolyFill,
		observe: observe,
		unobserve: unobserve
	};
});