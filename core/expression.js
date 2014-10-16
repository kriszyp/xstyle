define('xstyle/core/expression', ['xstyle/core/utils', 'xstyle/core/Definition'], function(utils, Definition){
	// handles the creation of reactive expressions
	var nextId = 1;
	function get(target, path){
		var name = path[0];
		if(name && target){
			return get(target.property(name), path.slice(1));
		}
		return target;
	}
	function observe(target, callback){
		return utils.when(target, function(target){
			return (target && target.observe) ? target.observe(callback) : callback(target);
		});
	}
	function contextualize(callback){
		return function(target){
			if(target && target.forElement){
				return {
					forElement: function(element){
						var result = target.forElement(element);
						var targetElement = result.element;
						result = callback(result);
						if (result) {
							result.element = targetElement;
						}
						return result;
					}
				};
			}
			return callback(target);
		}
	}
	function set(target, path, value){
		get(target, path.slice(0, path.length - 1), function(target){
			var property = path[path.length - 1];
			target.set ?
				target.set(property, value) :
				target[property] = value;
		});
	}
	function someHasProperty(array, property){
		for(var i = 0, l = array.length; i < l; i++){
			var item = array[i];
			if(item && typeof item == 'object' && property in item){
				return true;
			}
		}
	}
	function selfResolving(func){
		func.selfResolving = true;
		return func;
	}
	function resolved(callback, returnArray){
		return selfResolving(function resolve(){
			var args = arguments;
			var resolved;
			if(resolve.skipResolve){
				resolved = args;
			}else{
				resolved = [];
				for(var i = 0, l = args.length; i < l; i++){
					resolved[i] = evaluateExpression(this, args[i]);
				}
			}
			return callback[returnArray ? 'call' : 'apply'](this, resolved);
		});
	}

	function ready(callback, returnArray){
		return resolved(function(inputs){
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
		}, true);
	}
	var nextId = 1;
	function contextualCache(func, reverse){
		return ready(function(inputs){
			var caches = {};
			var nonContextCache;
			var variable = {
				// TODO: make ids have a little better names
				id: 'x-variable-' + nextId++,
				valueOf: function(context){
					// first check to see if we have the variable cached for this context
					var contextualizedInputResults = [];
					var useCache = this.dependents;
					if(useCache){
						if(context){
							var cache = context.getCache(this);
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
					for(var i = 0, l = inputs.length; i < l; i++){
						contextualizedInputResults[i] = inputs[i].valueOf(trackedContext);
					}
					var result = ready(func)(contextualizedInputResults);
					if(useCache && cache){
						utils.when(result, function(result){
							cache.set(trackedContext, result);
						});
					}
					return result;
				},
				property: function(key){
					var propertyVariable = contextualCache(function(object){
						Object.observe(object, function(){
							// TODO: only invalide the property with the correct name
							// TODO: only setup Object.observe once
							propertyVariable.invalidate();
						});
						return object[key];
					})(this);
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
				}

			};
			if(reverse && someHasProperty(inputs, 'put')){
				variable.put = function(value, context){
					reverse(value, inputs, context);
					variable.invalidate(context);
				};
			}
			return variable;
		}, true);
	}
	function contextualized(callback, returnArray){
		// this function is responsible for contextualizing a result
		// based on the context of the arguments/inputs
		return ready(function(inputs){
			inputs.id = nextId++;
			var isElementDependent;
			// TODO: eventually we probably want to abstract out contextualization
			if(someHasProperty(inputs, 'forElement')){
				return {
					forElement: function(element){
						var mostSpecificElement;
						// now find the element that matches that rule, in case we are dealing with a child
						var parentElement;
						var outputs = [];
						for(var i = 0, l = inputs.length; i < l; i++){
							var input = inputs[i];
							// now find the element that is keyed on
							if(input && input.forElement){
								input = input.forElement(element, input.length == 1);
							}
							outputs[i] = input;
							// we need to find the most parent element that we need to vary on for this computation 
							var varyOnElement = parentElement = input.element;
							if(mostSpecificElement){
								// check to see if one its parent is the mostSpecificElement
								while(parentElement && parentElement != mostSpecificElement){
									parentElement = parentElement.parentNode;
								}
								// if so, we have a new most specific
							}
							if(parentElement){
								mostSpecificElement = varyOnElement;
							}
						}
						// make sure we indicate the store we are keying off of
						var computation = mostSpecificElement['expr-result-' + inputs.id];
						if(!computation){
							mostSpecificElement['expr-result-' + inputs.id] = computation = callback[returnArray ? 'call' : 'apply'](this, outputs);
							computation && (computation.element = mostSpecificElement);
						}
						return computation;
					},
					inputs: inputs
				};
			}
			return callback[returnArray ? 'call' : 'apply'](this, inputs);
		}, true);
	}
	function react(forward, reverse){
		return function(){
			var inputs = arguments;
			var definition = this;
			for(var i = 0, l = inputs.length; i < l; i++){
				var input = inputs[i];
				input.depend && input.depend(definition);
			}
			var compute = function(context){
				var contextualizedResults = [];
				// TODO: make an opt-out for this
				for(var i = 0, l = inputs.length; i < l; i++){
					contextualizedResults[i] = inputs[i].valueOf(context);
				}
				if(forward.selfWaiting){
					return forward.apply(definition, contextualizedResults);
				}
				// wait for the values to be received
				return utils.whenAll(contextualizedResults, function(results){
					return forward.apply(definition, results);
				});
			};
			compute.reverse = reverse;
			return compute;
		};


		// based on reactive inputs, define a new reactive,
		// that uses the callback function to compute new values
		return contextualized(function(inputs){
			function computeResult(){
				var values = [];
				for(var i = 0, l = inputs.length; i < l; i++){
					var input = inputs[i];
					values[i] = input && input.valueOf();
				}
				return callback.valueOf().apply(this, values);
			}
			if(someHasProperty(inputs, 'depend')){
				var dependents;
				var result = {
					depend: function(dependent){
						if(!dependents){
							for(var i = 0, l = inputs.length; i < l; i++){
								var input = inputs[i];
								input.depend && input.depend(this);
							}
							dependents = [];
						}
						dependents.push(dependent);
						return {
							remove: function () {
								for(var i = 0, l = handles.length; i < l; i++){
									var handle = handles[i];
									handle && handle.remove && handle.remove();
								}
							}
						};
					},
					invalidate: function(){
						for(var i = 0, l = dependents.length; i < l; i++){
							dependents[i].invalidate();
						}
					},
					valueOf: function(){
						return computeResult();
					},
					inputs: inputs
				};
				if(reverse && someHasProperty(inputs, 'put')){
					result.put = function(value){
						reverse(value, inputs);
					};
				}
				return result;
			}
			return computeResult();
		}, true);
	}
	var deny = {};
	var operatingFunctions = {};
	var operators = {};
	function getOperatingFunction(expression){
		return operatingFunctions[expression] ||
			(operatingFunctions[expression] =
				new Function('a', 'b', 'return ' + expression));
	}
	function operator(operator, precedence, forward, reverseA, reverseB){
		// defines the standard operators
		var reverse = function(output, inputs){
			var a = inputs[0],
				b = inputs[1];
			if(a && a.put){
				var result = reverseA(output, b && b.valueOf());
				if(result !== deny){
					a.put(result);
				}
			}else if(b && b.put){
				b.put(reverseB(output, a && a.valueOf()));
			}else{
				throw new TypeError('Can not put');
			}
		};
		// define a function that can lazily ensure the operating function
		// is available
		var operatorHandler = function(){
			var operatorReactive;
			forward = getOperatingFunction(forward);
			reverseA = reverseA && getOperatingFunction(reverseA);
			reverseB = reverseB && getOperatingFunction(reverseB);
			var args = arguments;
			// TODO: depend on each argument
			operators[operator] = operatorReactive = react(forward, reverse);
			addFlags(operatorReactive);
			return operatorReactive.apply(this, arguments);
		};
		function addFlags(operatorHandler){
			operatorHandler.skipResolve = true;
			operatorHandler.precedence = precedence;
			operatorHandler.infix = reverseA === true || !!reverseB;
		}
		addFlags(operatorHandler);
		operators[operator] = operatorHandler;
	}
	operator('+', 5, 'a+b', 'a-b', 'a-b');
	operator('-', 5, 'a-b', 'a+b', 'b-a');
	operator('*', 6, 'a*b', 'a/b', 'a/b');
	operator('/', 6, 'a/b', 'a*b', 'b/a');
	operator('^', 7, 'a^b', 'a^(-b)', 'Math.log(a)/Math.log(b)');
	operator('?', 2, 'b[a?0:1]', 'a===b[0]||(a===b[1]?false:deny)', '[a,b]');
	operator(':', 3, '[a,b]', 'a[0]?a[1]:deny', 'a[1]');
	operator('!', 8, '!a', '!a');

	function evaluateExpression(rule, value){
		// evaluate an expression
		/*
		// TODO: do we need to cache this?
		var binding = rule['var-expr-' + name];
		if(variables){
			return binding;
		}*/
		var i;
		var part;
		value = value.join ? value.slice() : [value];
		for(i = 0; i < value.length; i++){
			part = value[i];
			if(typeof part == 'string'){
				// parse out operators
				// TODO: change this to a replace so we can find any extra characters to report
				// a syntax error
				var parts = part.match(/"[^\"]*"|[+-\/\?\:^*!&|]+|[\w_$\.\/-]+/g);
				var spliceArgs = [i, 1];
				if(parts){
					spliceArgs.push.apply(spliceArgs, parts);
				}
				// splice them back into the list
				value.splice.apply(value, spliceArgs);
				// adjust the index
				i += spliceArgs.length - 3;
			}
		}
		var lastOperatorPrecedence;
		var stack = [];
		var lastOperator;
		// TODO: might only enable this in debug mode
		var dependencies = {};
		// now apply operators
		for(i = 0; i < value.length; i++){
			part = value[i];
			if(part.operator == '('){
				var func = stack[stack.length - 1];
				// pop off the name that precedes
				if(func === undefined || operators.hasOwnProperty(func)){
					part = evaluateExpression(rule, part.getArgs()[0]);
				}else{
					stack.pop();
					part = (function(func, args){
						var resolved;
						var compute;
						var definition = new Definition(function(context){
							return utils.when(func.valueOf(), function(func){
								if(!func.selfResolving){
									if(!resolved){
										resolved = [];
										for(var i = 0, l = args.length; i < l; i++){
											resolved[i] = evaluateExpression(rule, args[i]);
										}
										compute = react(func).apply(definition, resolved);
									}
									return compute(context);
								}
								return func.apply(definition, args).valueOf(context);
							});
						});
						return definition;
					})(func, part.getArgs());
				}
			}else if(operators.hasOwnProperty(part)){
				// it is an operator, it has been added to the stack, but we need
				// to apply on the stack of higher priority
				var operator = operators[part];
				windDownStack(operator);
				lastOperatorPrecedence = (lastOperator || operator).precedence;
			}else if(part > -1){
				// a number literal
				part = +part;
			}else if(part.isLiteralString){
				// a quoted string
				part = part.value;
			}else{
				// a reference
				var propertyParts = part.split(/\s*\/\s*/);
				var firstReference = propertyParts[0];
				var target = rule.getDefinition(firstReference);
				if(typeof target == 'string' || target instanceof Array){
					target = evaluateExpression(rule, target);
				}else if(target === undefined){
					throw new Error('Could not find reference "' + firstReference + '"');
				}
				dependencies[firstReference] = target;
				if(propertyParts.length > 1){
					target = get(target, propertyParts.slice(1));
				}
				part = target;
			}
			stack.push(part);
		}
		// finally apply any operators still on the stack
		windDownStack({precedence: 1});
		function windDownStack(operator){
			// apply waiting operators of higher precedence
			while(lastOperatorPrecedence >= operator.precedence){
				var lastOperand = stack.pop();
				var executingOperator = operators[stack.pop()];
				var result = new Definition();
				result.setCompute(executingOperator.apply(result, executingOperator.infix ?
					[stack.pop(), lastOperand] : [lastOperand]));
				lastOperator = stack.length && stack[stack.length-1];
				stack.push(result);
				lastOperatorPrecedence = lastOperator && operators[lastOperator] && operators[lastOperator].precedence;
			}
		}
		part = stack[0];
		part.inputs = dependencies;
		return part;
	}

	return {
		resolved: resolved,
		ready: ready,
		contextualized: contextualized,
		react: react,
		observe: observe,
		evaluate: evaluateExpression,
		selfResolving: selfResolving
	};
});
