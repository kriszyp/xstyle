define('xstyle/core/observe', [], function(){
	// An observe function, requires getter/setter support in the target (I9+ for regular objects, IE8+ for DOM nodes)
	var observe = /*Object.observe || */ function(target, property, listener){
		var listenersProperty = '_listeners_' + property;
		var listeners = target[listenersProperty];
		if(!listeners){
			var currentValue = target[property];
			Object.defineProperty(target, property, {
				get: function(){
					return currentValue;
				},
				set: function(value){
					currentValue = value;
					for(var i = 0, l = listeners.length;i < l; i++){
						listeners[i].call(this, value);
					}
				}
			});
			listeners = target[listenersProperty] = [];
		}
		listeners.push(listener);
		// TODO: return handle with remove method
	};
	observe.get = function(target, property, listener){
		listener(target[property]);
		return observe(target, property, listener);
	};
	return observe;
});