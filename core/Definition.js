define(['xstyle/core/utils', 'xstyle/core/Context', 'xstyle/core/observe'],
		function(utils, Context, observe){
	function Definition(computeValue, reverseCompute){
		// computeValue: This is function (or promise to a function) that is called to calculate
		// the value of this definition
		this.computeValue = computeValue;
		if(reverseCompute){
			this.setReverseCompute(reverseCompute);
		}
	}
	// a context with no context, for when the context is missing
	var noContext = new Context();

	var nextId = 1;
	Definition.prototype = {
		// TODO: make ids have a little better names
		id: 'x-variable-' + nextId++,
		valueOf: function(context){
			context = context || noContext;
			// first check to see if we have the variable cached for this context
			var cache;
			var useCache = this.dependents;
			if(useCache){
				this.cache = cache = context.getCache(this, this.cache);
				var cached = cache.get('value', context);
				// check the cache first
				if(cached){
					return cached;
				}
			}
			var trackedContext = context && context.track();
			var definition = this;
			var result = utils.when(this.computeValue, function(computeValue){
				// skip the promise in the future
				definition.computeValue = computeValue;
				return computeValue(trackedContext);
			});
			if(useCache && cache){
				utils.when(result, function(result){
					cache.set('value', result, trackedContext);
				});
			}
			return result;
		},
		property: function(key){
			var properties = this._properties || (this._properties = {});
			var propertyDefinition = properties[key];
			if(!propertyDefinition){
				// create the property definition
				var definition = this;
				propertyDefinition = properties[key] = new Definition(function(context){
					var trackedContext = context.track();
					return utils.when(definition.valueOf(trackedContext), function(object){
						var cache = context.getCache(this);
						var observer = cache.get('observer', trackedContext);
						if(!observer && object && typeof object == 'object'){
							// if we haven't recorded any observer for this context, let's
							// setup one now
							observer = function(event){
								var property = properties[event.name];
								if(property && property.invalidate){
									property.invalidate();
								}
							};
							observe.observe(object, observer);
							cache.set('observer', observer, trackedContext);
						}
						// used by the polyfill to setup setters
						if(observer.addKey){
							observer.addKey(key);
						}
						return object && object[key];
					});
				});
				propertyDefinition.put = function(value, context){
					return utils.when(definition.valueOf(context), function(object){
						object[key] = value;
					});
				};
				propertyDefinition.id = this.id + '-' + key;
			}
			return propertyDefinition;
		},
		invalidate: function(context){
			context = context || noContext;
			var caches = this.caches || 0;
			var i, l;
			for(i = 0, l = caches.length; i < l; i++){
				var cache = caches[i];
				var observer = cache.get('observer', context);
				// TODO: there might actually be a collection of observers
				if(observer){
					observe.unobserve(observer);
				}
				caches[i].clear(context);
			}
			var properties = this._properties;
			for(i in properties){
				properties[i].invalidate();
			}
			var dependents = this.dependents || 0;
			for(i = 0, l = dependents.length; i < l; i++){
				dependents[i].invalidate(context);
			}
		},
		depend: function(dependent){
			(this.dependents || (this.dependents = [])).push(dependent);
		},
		setReverseCompute: function(reverse){
			this.put = function(value, context){
				reverse(value, this.inputs, context);
				this.invalidate(context);
			};
		},
		setCompute: function(compute){
			this.computeValue = compute;
			this.invalidate();
		},
		setSource: function(value){
			this.computeValue = function(){
				return value;
			};
			this.invalidate();
		},
		newElement: function(context){
			return utils.when(this.valueOf(context), function(value){
				return value && value.newElement && value.newElement(context);
			});
		}
	};
	function someHasProperty(array, property){
		for(var i = 0, l = array.length; i < l; i++){
			var item = array[i];
			if(item && typeof item == 'object' && property in item){
				return true;
			}
		}
	}
	function ready(callback, returnArray){
		return function(inputs){
			// handles waiting for async inputs
			if(someHasProperty(inputs, 'then')){
				// we have asynch inputs, do lazy loading
				return {
					then: function(onResolve, onError){
						var remaining = 1;
						var readyInputs = [];
						for(var i = 0; i < inputs.length; i++){
							var input = inputs[i];
							remaining++;
							if(input && input.then){
								(function(i){
									input.then(function(value){
										readyInputs[i] = value;
										onEach();
									}, onError);
								})(i);
							}else{
								readyInputs[i] = input;
								onEach();
							}
						}
						onEach();
						function onEach(){
							remaining--;
							if(!remaining){
								onResolve(callback[returnArray ? 'call' : 'apply'](this, readyInputs));
							}
						}
					},
					inputs: inputs
				};
			}
			// just sync inputs
			return callback[returnArray ? 'call' : 'apply'](this, inputs);
		};
	}

	return Definition;
});