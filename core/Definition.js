define(['xstyle/core/utils'], function(utils){
	function Definition(computeValue){
		// computeValue: This is function (or promise to a function) that is called to calculate
		// the value of this definition
		this.computeValue = computeValue;
	}
	var nextId = 1;
	Definition.prototype = {
		// TODO: make ids have a little better names
		id: 'x-variable-' + nextId++,
		valueOf: function(context){
			// first check to see if we have the variable cached for this context
			var contextualizedInputResults = [];
			var useCache = this.dependents;
			if(useCache){
				if(context){
					var cache = context.getCache();
					var caches = (this.caches || (this.caches = []));
					if(caches.indexOf(cache) == -1){
						caches.push(cache);
					}
					var cached = cache.get(context);
					// check the cache first
					if(cached){
						return cached;
					}
				}else{
					
				}
			}
			var trackedContext = context && context.track();
			var inputs = this.inputs || 0;
			for(var i = 0, l = inputs.length; i < l; i++){
				contextualizedInputResults[i] = inputs[i].valueOf(trackedContext);
			}
			var definition = this;
			var result = utils.when(this.computeValue, function(computeValue){
				// skip the promise in the future
				definition.computeValue = computeValue;
				return ready(computeValue)(contextualizedInputResults);
			});
			if(useCache && cache){
				utils.when(result, function(result){
					cache.set(trackedContext, result);
				});
			}
			return result;
		},
		property: function(key){
			// TODO: cache the properties
			var definition = this;
			var propertyVariable = new Definition(utils.when(this.valueOf(), function(object){
				Object.observe(object, function(){
					// TODO: only invalide the property with the correct name
					// TODO: only setup Object.observe once
					propertyVariable.invalidate();
				});
				return object[key];
			}));
			propertyVariable.put = function(value){
				return utils.when(definition.valueOf(), function(object){
					object[key] = value;
				});
			};
			// TODO: set a nice id here
		},
		invalidate: function(context){
			var caches = this.caches || 0;
			for(var i = 0, l = caches.length; i < l; i++){
				caches[i].clear(this);
			}
			// TODO: invalidate all the dependentVariables
			// TODO: invalidate any sub-properties
			var dependents = this.dependents;
			for(var i = 0, l = dependents.length; i < l; i++){
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