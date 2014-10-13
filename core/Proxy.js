define('xstyle/core/Proxy', ['xstyle/core/utils'], function(utils){
	var when = utils.when;

	function Proxy(value){
		// just assume everything will be observed, we could change the optimizations later
		if(value !== undefined){
			this.setSource(value);
		}
	}
	Proxy.prototype = {
		property: function(key){
			var properties = this.hasOwnProperty('_properties') ?
				this._properties : (this._properties = {});
			var proxy = properties[key];
			if(proxy){
				return proxy;
			}
			proxy = properties[key] = new Proxy(this.get(key));
			proxy.parent = this;
			proxy.name = key;
			return proxy;
		},
		depend: function(dependent){
			(this._dependents || (this._dependents = [])).push(dependent);
			// TODO: return handle with remove method
		},
		invalidate: function(context){
			var dependents = this._dependents || 0;
			for(var i = 0; i < dependents.length; i++){
				dependents[i].invalidate(context);
			}
		},
		setSource: function(source){
			var proxy = this;
			if(this.handle && this.handle.remove){
				this.handle.remove();
			}
			when(source, function(source){
				proxy.source = source;
				proxy.invalidate();
				if(source && source.depend){
					proxy.handle = source.depend(this);
				}
				var properties = proxy._properties;
				for(var i in properties){
					proxy.property(i).setSource(source && source.property && source.property(i));
				}
			});
		},
		valueOf: function(context){
			var source = this.source;
			return source && source.observe ? source.valueOf(context) : source;
		},
		get: function(key){
			var source = this.source;
			return source ?
				source.get ? source.get(key) : source[key] :
				this['value-' + key];
		},
		set: function(key, value){
			var source = this.source;
			if(source.set){
				return source.set(key, value);
			}
			if(source){
				source[key] = value;
			}else{
				this['value-' + key] = value;
			}
			var property = this._properties && this._properties[key];
			if(property){
				property.put(value);
			}
			return value;
		},
		put: function(value, context){
			var source = this.source;
			if(source && source.put){
				return source.put(value, context);
			}else if(this.parent){
				this.parent[this.name] = value;
			}
			return this.setSource(value);
		},
		toJSON: function(){
			return this.valueOf();
		}
	};
	return Proxy;
});