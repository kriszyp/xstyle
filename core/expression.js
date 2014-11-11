define('xstyle/core/expression', ['xstyle/core/utils', 'xstyle/core/Definition'], function(utils, Definition){
	// handles the creation of reactive expressions
	function get(target, path){
		var name = path[0];
		if(name && target){
			return get(target.property ? target.property(name) : target[name], path.slice(1));
		}
		return target;
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

	function contextualize(type, inputs, callback){
		if(someHasProperty(inputs, type)){
			var contextualizedObject = {};
			contextualizedObject[type] = function(element){
				var contextualized = [];
				for(var i =0, l = inputs.length; i < l; i++){
					var input = inputs[i];
					if(input && typeof input[type] == 'function'){
						//if(input.selectElement)
						input = input[type](element);
					}
					contextualized[i] = input;
				}
				return callback(contextualized);
			};
			return contextualizedObject;
		}
		return callback(inputs);

	}
	function react(forward, reverse){
		return function(){
			var inputs = arguments;
			var definition = this;
			for(var i = 0, l = inputs.length; i < l; i++){
				var input = inputs[i];
				input.depend && input.depend(definition);
			}
			var compute = function(){
				var results = [];
				// TODO: make an opt-out for this
				if(forward.selfExecuting){
					return forward.apply(definition, inputs);
				}
				for(var i = 0, l = inputs.length; i < l; i++){
					results[i] = inputs[i].valueOf();
				}
				if(forward.selfWaiting){
					return forward.apply(definition, results);
				}
				// wait for the values to be received
				return utils.whenAll(results, function(inputs){
					// contextualize along each dimension
					return contextualize('forRule', inputs, function(inputs){
						return contextualize('forElement', inputs, function(results){
							return forward.apply(definition, results);
						});
					});
				});
			};
			compute.reverse = function(value){
				return reverse(value, inputs);
			};
			return compute;
		};

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
	operator('+', 6, 'a+b', 'a-b', 'a-b');
	operator('-', 6, 'a-b', 'a+b', 'b-a');
	operator('*', 5, 'a*b', 'a/b', 'a/b');
	operator('/', 5, 'a/b', 'a*b', 'b/a');
	operator('^', 7, 'a^b', 'a^(-b)', 'Math.log(a)/Math.log(b)');
	operator('?', 16, 'b[a?0:1]', 'a===b[0]||(a===b[1]?false:deny)', '[a,b]');
	operator(':', 15, '[a,b]', 'a[0]?a[1]:deny', 'a[1]');
	operator('!', 4, '!a', '!a');
	operator('>', 8, 'a>b', true);
	operator('>=', 8, 'a>=b', true);
	operator('<', 8, 'a<b', true);
	operator('<=', 8, 'a<=b', true);
	operator('==', 9, 'a==b', true);
	operator('===', 9, 'a===b', true);
	operator('&', 8, 'a&&b', true);
	operator('|', 8, 'a||b', true);

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
				var parts = part.match(/"[^\"]*"|[+\-\<\>\|\/\?\:^*!&|]+|[\w_$\.\/-]+/g);
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
					// a function call
					stack.pop();
					part = (function(func, args){
						var resolved;
						var compute;
						var definition = new Definition(function(){
							return utils.when(func.valueOf(), function(func){
								if(!func.selfResolving){
									if(!resolved){
										resolved = [];
										for(var i = 0, l = args.length; i < l; i++){
											resolved[i] = evaluateExpression(rule, args[i]);
										}
										compute = react(func).apply(definition, resolved);
									}
									return compute();
								}
								return func.apply(definition, args).valueOf();
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
		windDownStack({precedence: 100});
		function windDownStack(operator){
			// apply waiting operators of higher precedence
			while(lastOperatorPrecedence <= operator.precedence){
				var lastOperand = stack.pop();
				var executingOperator = operators[stack.pop()];
				var result = new Definition();
				result.setCompute(executingOperator.apply(result, executingOperator.infix ?
					[stack.pop(), lastOperand] : [lastOperand]));
				lastOperator = stack.length ? stack[stack.length-1] : undefined;
				stack.push(result);
				lastOperatorPrecedence = lastOperator && operators[lastOperator] && operators[lastOperator].precedence;
			}
		}
		part = stack[0];
		part.inputs = dependencies;
		return part;
	}

	return {
		react: react,
		evaluate: evaluateExpression,
		selfResolving: selfResolving
	};
});
