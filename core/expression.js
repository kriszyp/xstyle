define('xstyle/core/expression', ['xstyle/core/utils'], function(utils){
	// handles the creation of reactive expressions
	var jsKeywords = {
		'true': true, 'false': false, 'null': 'null', 'typeof': 'typeof', or: '||', and: '&&'
	};
	var nextId = 1;
	function get(target, path, callback){
		return utils.when(target, function(target){
			var name = path[0];
			if(!target){
				return callback(name || target);
			}
			if(name && target.property){
				return get(target.property(name), path.slice(1), callback);
			}
			if(target.observe){
				return target.observe(name ? function(value){
					get(value, path, callback);
				} : callback);
			}
			if(name){
				return get(target[name], path.slice(1), callback);
			}
			return callback(target);
		});
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
			if(property in item){
				return true;
			}
		}
	}
	function resolveArguments(callback){
		return {
			onArguments: function(rule, args){
				return callback(evaluateExpression(rule, args));
			},
			call: callback
		};
	}
	function whenAll(callback){
		return resolveArguments(function(){	
			// handles waiting for async inputs
			if(someHasProperty(arguments, 'then')){
				var inputs = arguments;
				// we have asynch inputs, do lazy loading
				return {
					then: function(onResolve, onError){
						var remaining = 1;
						var resolvedInputs;
						for(var i = 0; i < l; i++){
							var input = inputs[i];
							if(input && input.then){
								remaining++;
								(function(i){
									input.then(function(value){
										resolvedInputs[i] = value;
										onEach();
									}, onError);
								})(i);
							}else{
								resolvedInputs[i] = input;
								onEach();
							}
						}
						onEach();
						function onEach(){
							remaining--;
							if(!remaining){
								onResolve(callback(inputs));
							}
						}
					}
				};
			}
			// just sync inputs
			return callback(arguments);
		});
	}
	function contextualized(callback){
		// this function is responsible for contextualizing a result
		// based on the context of the arguments/inputs
		return whenAll(function(inputs){
			inputs.id = nextId++;
			var isElementDependent;
			// TODO: eventually we probably want to abstract out contextualization
			if(someHasProperty(inputs, 'forElement')){
				return {
					forElement: function(element){
						var mostSpecificElement;
						// now find the element that matches that rule, in case we are dealing with a child
						var parentElement;
						for(var i = 0, l = inputs.length; i < l; i++){
							var input = inputs[i];
							var target = input[0];
							// now find the element that is keyed on
							if(target.forElement){
								target = input[0] = target.forElement(element, input.length == 1);
							}
							// we need to find the most parent element that we need to vary on for this computation 
							var varyOnElement = parentElement = target.element;
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
							mostSpecificElement['expr-result-' + inputs.id] = computation = callback(inputs);
							computation.element = mostSpecificElement;
						}
						return computation;
					}
				};
			}
			return callback(inputs);
		})
	}
	function react(callback, reverse){
		// based on reactive inputs, define a new reactive,
		// that uses the callback function to compute new values
		return contextualized(function(inputs){
			function computeResult(){
				var values = [];
				for(var i = 0, l = inputs.length; i < l; i++){
					var input = inputs[i];
					values[i] = input && input.valueOf();
				}
				return callback(values);
			}
			if(someHasProperty(inputs, 'observe')){
				var result = {
					observe: function(listener){
						for(var i = 0, l = inputs.length; i < l; i++){
							var input = inputs[i];
							input && input.observe && input.observe(function(){
								listener(computeResult());
							});
						}
					},
					valueOf: function(){
						return computeResult();
					}
				};
				if(reverse && someHasProperty(inputs, 'put')){
					result.put = function(value){
						reverse(value, inputs);
					};
				}
				return result;
			}
			return computeResult();
		});
	}
	function operator(precedence, forward, reverseA, reverseB){
		// defines the standard operators
		function evaluate(expression){
			return eval('(0||function(a,b){return ' + expression + ';})');
		}
		var forward = evaluate(forward);
		var reverseA = evaluate(reverseA);
		var reverseB = evaluate(reverseB);
		var result = react(function(inputs){
			return forward(inputs[0], inputs[1]);
		}, function(output, inputs){
			var a = inputs[0],
				b = inputs[1];
			if(a.put){
				a.put(reverseA(output, b.valueOf()));
			}else if(b.put){
				b.put(reverseB(output, a.valueOf()));
			}else{
				throw new TypeError('Can not put');
			}
		});
		result.precedence = precedence;
		return result;
	}
	var operators = {
		'+': operator(2, 'a+b', 'a-b', 'a-b'),
		'-': operator(2, 'a-b', 'a+b', 'b-a'),
		'*': operator(1, 'a*b', 'a/b', 'a/b'),
		'/': operator(1, 'a/b', 'a*b', 'b/a')
	};
	function evaluateExpression(rule, value){
		// evaluate an expression
		/*
		// TODO: do we need to cache this?
		var binding = rule['var-expr-' + name];
		if(variables){
			return binding;
		}*/
		value = value.join ? value : [value];
		for(var i = 0; i < value.length; i++){
			var part = value[i];
			if(typeof part == 'string'){
				// parse out operators
				var spliceArgs = [i, 1].concat(part.match(/"[^\"]*"|[+-\/*!&|]+|[a-zA-Z_][\w_$\.\/-]*/g));
				// splice them back into the list
				value.splice.apply(value, spliceArgs);
				// adjust the index
				i += spliceArgs - 3;
			}
		}
		var lastOperatorPrecedence;
		var stack = [];
		var lastOperator;
		// now apply operators
		for(var i = 0; i < value.length; i++){
			var part = value[i];
			if(operators.hasOwnProperty(part)){
				var operator = operators[part];
				windDownStack(operator);
				lastOperatorPrecedence = (lastOperator || operator).precedence;
			}else if(jsKeywords.hasOwnProperty(part)){
				part = value[i] = jsKeywords[part];
			}else{
				var propertyParts = part.split('/');
				var firstReference = propertyParts[0];
				var target = rule.getDefinition(firstReference);
				if(typeof target == 'string' || target instanceof Array){
					target = evaluateExpression(rule, target);
				}else if(!target){
					throw new Error('Could not find reference "' + firstReference + '"');
				}
				var path, j = 1;
				while((path = propertyParts[j++])){
					target.property(path);
				}
				part = value[i] = target;
			}
			stack.push(part);
		}
		windDownStack({precedence: 0});
		function windDownStack(operator){
			while(lastOperatorPrecedence > operator.precedence){
				var operandB = stack.pop();
				var executingOperator = operators[stack.pop()];
				var result = executingOperator.call(stack.pop(), operandB);
				stack.push(result);
				lastOperator = stack.length && stack[stack.length-1];
				lastOperatorPrecedence = lastOperator && lastOperator.precedence;
			}
		}

		return stack[0];
	}
	return {
		resolveArguments: resolveArguments,
		whenAll: whenAll,
		contextualized: contextualized,
		react: react,
		evaluate: evaluateExpression
	};
});
