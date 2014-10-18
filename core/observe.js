define('xstyle/core/observe', [], function(){
	// This is an polyfill for Object.observe with just enough functionality
	// for what xstyle needs
	// An observe function, with polyfile
	var observe = Object.observe || 
		/*
		// for the case of setter support, but no Object.observe support (like IE9, IE10)
		// this is much faster than polling
			Object.getOwnPropertyDescriptor ? 
		function observe(target, listener){

			for(var i in target){
				addKey(i);
			}
			listener.addKey = addKey;
			function addKey(key){
				var currentValue = target[key];
				Object.getOwnPropertyDescriptor(target);
				Object.defineProperty(target, key, {
					get: function(){
						return currentValue;
					},
					set: function(value){
						currentValue = value;
						queue(listener, {name: key});
					}
				});
			}

		} :*/
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
	var unobserve = Object.unobserve ||
		function(target, listener){
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
		for(var i in previous){
			if(previous.hasOwnProperty(i) && previous[i] !== current[i]){
				// a property has changed
				previous[i] = current[i];
				callback({name: i});
			}
		}
		for(var i in current){
			if(current.hasOwnProperty(i) && !previous.hasOwnProperty(i)){
				// a property has been added
				previous[i] = current[i];
				callback({name: i});
			}
		}
	}
	return {
		observe: observe,
		unobserve: unobserve
	};
});