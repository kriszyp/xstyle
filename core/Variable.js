define(['xstyle/core/utils', 'xstyle/core/lang'],
		function(utils, lang){
	var noCacheEntry = {};
	var deny = {};
	var WeakMap = lang.WeakMap;

	var nextId = 1;
	function contextualizeElement(variable, object, key){
		if(object && object.forElement){
			return {
				forElement: function(element){
					element = object.selectElement ? object.selectElement(element) : element;
					// TODO: use weakmap
					var cacheProperty = ['_cache_' + variable.id];
					if(cacheProperty in element){
						var cacheObserver = element[cacheProperty + 'observe'];
						if(cacheObserver.addKey){
							cacheObserver.addKey(key);
						}
						return element[cacheProperty][key];
					}
					var result = element[cacheProperty] = object.forElement(element);
					var observer = element[cacheProperty + 'observe'] = setupObserve(variable, result, key, {
						elements: [element]
					});
					element.xcleanup = function(destroy){
						if(destroy){
							lang.unobserve(result, observer);
						}
					};
					return result[key];
				}
			};
		}
		// else
	}
	function setupObserve(variable, object, key, invalidated){
		var properties = variable._properties;
		var observer;
		if(typeof object == 'object'){
			// if we haven't recorded any observer for this context, let's
			// setup one now
			observer = function(events){
				for(var i = 0; i < events.length; i++){
					var property = properties[events[i].name];
					if(property && property.invalidate){
						property.invalidate(invalidated);
					}
				}
			};
			lang.observe(object, observer);
			if(observer.addKey){
				observer.addKey(key);
			}
		}
		return observer;
	}
	function Variable(computeValue, setValue){
		if(computeValue){
			this.computeValue = computeValue;
		}
		if(setValue){
			this.setValue = setValue;
		}
	}
	Variable.prototype = {
		// TODO: make ids have a little better names
		id: 'x-variable-' + nextId++,
		cache: noCacheEntry,
		getCache: function(context){
			var cache = this.cache || (this.cache = new WeakMap());
			while(cache.getNextKey){
				var propertyName = cache.propertyName;
				var keyValue = context.get(propertyName);
				// TODO: handle the case of a primitive
				var nextCache = cache.get(keyValue);
				if(!nextCache){
					nextCache = new WeakMap();
					cache.set(keyValue, nextCache);
				}
				cache = nextCache;
			}
			return cache;
		},
		valueOf: function(context){
			// first check to see if we have the variable already computed
			var useCache = this.dependents || this._properties;
			if(useCache){
				// TODO: use when
				// TODO: Check the context to determine if it is cached
				//if(this.cache !== noCacheEntry){
					//return this.cache;
				//}
			}
			var cache = this.getCache(context);
			if('value' in cache){
				return cache.value;
			}
			var cache = this.cache;
			
			var watchedContext = {
				get: function(propertyName, select){
					var keyValue = context.get(propertyName, select);
					// determine if we have already keyed of this value
					if(cache.propertyName !== propertyName){
						// TODO: check it against all previous property names						
						if(!cache.propertyName){
							cache.propertyName = propertyName;
						}
						var nextCache = cache.get(keyValue);
						if(!nextCache){
							nextCache = new WeakMap();
							cache.set(keyValue, nextCache);
						}
						cache = nextCache;
					}
					return keyValue;
				}
			};
			var computedValue = this.computeValue(watchedContext);
			cache.value = computedValue;
			return computedValue;
		},
		property: function(key){
			var properties = this._properties || (this._properties = {});
			var propertyVariable = properties[key];
			if(!propertyVariable){
				// create the property variable
				propertyVariable = properties[key] = new Property(this, key);
			}
			return propertyVariable;
		},
		apply: function(instance, args){
			return new Call(this, args);
		},

		invalidate: function(context){
			// TODO: there might actually be a collection of observers
			var observer = this.cacheObserve;
			if(observer){
				lang.unobserve(this.cache, observer);
				this.cacheObserve = null;
			}
			// clear the cache
			if(context){
				// just based on the context
				var cache = this.getCache(context);
				delete cache.value;
			}else{
				// delete our whole cache if it is an unconstrained invalidation
				this.cache = {};
			}

			var i, l, properties = this._properties;
			for( i in properties){
				properties[i].invalidate(context);
			}
			var dependents = this.dependents || 0;
			for(i = 0, l = dependents.length; i < l; i++){
				try{
					dependents[i].invalidate(context);
				}catch(e){
					console.error(e, 'invalidating a variable');
				}
			}
		},
		dependencyOf: function(dependent){
			var dependents = (this.dependents || (this.dependents = []));
			dependents.push(dependent);
			return {
				remove: function(){
					for(var i = 0; i < dependents.length; i++){
						if(dependents[i] === dependent){
							dependents.splice(i--, 1);
						}
					}
				}
			};
		},
		put: function(value, context){
			this.setValue(value);
			this.invalidate(context);
		},
		setValue: function(value){
			this.value = value;
		},
		computeValue: function(){
			return this.value;
		},
		observe: function(listener, context){
			// shorthand for setting up a real invalidation scheme
			if(this.computeValue){
				listener(this.valueOf(context));
			}
			var variable = this;
			return this.dependencyOf({
				invalidate: function(){
					listener(variable.valueOf());
				}
			});
		},
		newElement: function(){
			return utils.when(this.valueOf(), function(value){
				return value && value.newElement && value.newElement();
			});
		}
	};


	var Property = utils.compose(Variable, function Property(parent, key){
		this.parent = parent;
		this.key = key;
	},
	{
		init: function(){
			this.parent.dependencyOf(this);
		},
		computeValue: function(context){
			var key = this.key;
			var parent = this.parent;
			return utils.when(parent.valueOf(context), function(object){
				// TODO: cleanup
				setupObserve(parent, object, key, context);
				return object == null ? object : object[key];
			});
		},
		put: function(value, context){
			var key = this.key;
			var parent = this.parent;
			var property = this;
			return utils.when(parent.valueOf(context), function(object){
				if(object == null){
					return deny;
				}
				object[key] = value;
				return Variable.prototype.put.call(property, value, context);
			});
		}

	});

	// a call variable is the result of a call
	var Call = utils.compose(function Call(functionVariable, args){
		this.functionVariable = functionVariable;
		this.args = args;
	}, {
		init: function(){
			// depend on the function itself
			this.functionVariable.dependencyOf(this);
			// depend on the args
			var args = this.args;
			for(var i = 0, l = args.length; i < l; i++){
				var arg = args[i];
				arg.dependencyOf && arg.dependencyOf(this);
			}
		},
		computeValue: function(context){
			var call = this;
			return utils.when(this.functionVariable.valueOf(context), function(functionValue){
				return call.invoke(functionValue, call.args, context);
			});
		},
		put: function(value, context){
			var call = this;
			return utils.when(this.functionVariable.valueOf(context), function(functionValue){
				var result = call.invoke(function(){
					if(functionValue.reverse){
						functionValue.reverse.call(this, value, arguments, context);
					}else{
						return deny;
					}
				}, call.args, context);
				Variable.prototype.put.call(call, value, context);
				return result;
			});
		},
		invoke: function(functionValue, args, context){
			var instance = this.functionVariable.parent;
			if(functionValue.handlesContext){
				return functionValue.apply(instance, args, context);
			}else{
				var results = [];
				for(var i = 0, l = args.length; i < l; i++){
					results[i] = args[i].valueOf(context);
				}
				instance = instance && instance.valueOf(context);
				if(functionValue.handlesPromises){
					return functionValue.apply(instance, results, context);
				}else{
					// include the instance in whenAll
					results.push(instance);
					// wait for the values to be received
					return utils.whenAll(results, function(inputs){
						var instance = inputs.pop();
						return functionValue.apply(instance, inputs, context);
					});
				}
			}
		}
	});
	Variable.deny = deny;
	function addFlag(name){
		Variable[name] = function(functionValue){
			functionValue[name] = true;
		};
	}
	addFlag(Variable, 'handlesContext');
	addFlag(Variable, 'handlesPromises');
	return Variable;
});