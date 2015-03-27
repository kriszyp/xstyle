define('xstyle/core/expression', ['xstyle/core/utils', 'xstyle/core/Variable'], function(utils, Variable){
	// handles the creation of reactive expressions
	function get(target, path){
		var name = path[0];
		if(name && target){
			name = convertCssNameToJs(name);
			return get(target.property ? target.property(name) : target[name], path.slice(1));
		}
		return target;
	}
	var convertCssNameToJs = utils.convertCssNameToJs;
	var someHasProperty = utils.someHasProperty;
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
		return {
			apply: function(instance, inputs, definition){
				for(var i = 0, l = inputs.length; i < l; i++){
					var input = inputs[i];
					input.dependencyOf && input.dependencyOf(definition);
				}
				var compute = function(context){
					var results = [];
					// TODO: make an opt-out for this
					if(forward.selfExecuting){
						return forward.apply(instance, inputs, definition);
					}
					for(var i = 0, l = inputs.length; i < l; i++){
						results[i] = inputs[i].valueOf(context);
					}
					if(forward.selfWaiting){
						return forward.apply(instance, results, definition);
					}
					if(forward.handlesPromises){
						return forward.apply(instance, results, context);
					}else{
						// include the instance in whenAll
						results.push(instance);
						// wait for the values to be received
						return utils.whenAll(results, function(inputs){
							var instance = inputs.pop();
							return forward.apply(instance, inputs, context);
						});
					}
					// include the instance in whenAll
					results.push(instance);
					// wait for the values to be received
					return utils.whenAll(results, function(inputs){
						var instance = inputs.pop();
						return forward.apply(instance, results, definition);
					});
				};
				compute.reverse = function(value){
					return reverse(value, inputs);
				};
				return compute;
			}
		};
	}
	var deny = Variable.deny;
	var operatingFunctions = {};
	var operators = {};
	function getOperatingFunction(expression){
		// jshint evil: true
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
				return deny;
			}
		};
		// define a function that can lazily ensure the operating function
		// is available
		var operatorHandler = {
			apply: function(instance, args){
				var operatorReactive;
				forward = getOperatingFunction(forward);
				reverseA = reverseA && getOperatingFunction(reverseA);
				reverseB = reverseB && getOperatingFunction(reverseB);
				forward.reverse = reverse;
				operators[operator] = operatorReactive = new Variable(forward);

				addFlags(operatorReactive);
				return operatorReactive.apply(instance, args);
			}
		};
		function addFlags(operatorHandler){
			operatorHandler.precedence = precedence;
			operatorHandler.infix = reverseB !== false;
		}
		addFlags(operatorHandler);
		operators[operator] = operatorHandler;
	}
	// using order precedence from:
	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Operator_Precedence
	operator('+', 6, 'a+b', 'a-b', 'a-b');
	operator('-', 6, 'a-b', 'a+b', 'b-a');
	operator('*', 5, 'a*b', 'a/b', 'a/b');
	operator('/', 5, 'a/b', 'a*b', 'b/a');
//	operator('^', 7, 'a^b', 'a^(-b)', 'Math.log(a)/Math.log(b)');
	operator('?', 16, 'b[a?0:1]', 'a===b[0]||(a===b[1]?false:deny)', '[a,b]');
	operator(':', 15, '[a,b]', 'a[0]?a[1]:deny', 'a[1]');
	operator('!', 4, '!a', '!a', false);
	operator('%', 5, 'a%b');
	operator('>', 8, 'a>b');
	operator('>=', 8, 'a>=b');
	operator('<', 8, 'a<b');
	operator('<=', 8, 'a<=b');
	operator('==', 9, 'a===b');
	operator('&', 8, 'a&&b');
	operator('|', 8, 'a||b');

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
				var parts = part.match(/"[^\"]*"|[+\-<>\|\/\?\:^*!&|]+|[\w_$\.-]+/g);
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
				var functionVariable = stack[stack.length - 1];
				// pop off the name that precedes
				if(functionVariable === undefined || operators.hasOwnProperty(functionVariable)){
					part = evaluateExpression(rule, part.getArgs()[0]);
				}else{
					// a function call
					stack.pop();
					var args = part.getArgs();
					if(!functionVariable.handlesReferences){
						for(var i = 0, l = args.length; i < l; i++){
							args[i] = evaluateExpression(rule, args[i]);
						}
					}
					part = functionVariable.apply(functionVariable.parent, args);
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
				// a reference or property
				var propertyParts = part.split(/\s*\.\s*/);
				var firstReference = propertyParts[0];
				if(firstReference){
					var target = rule.getVariable(firstReference);
					if(typeof target == 'string' || target instanceof Array){
						target = evaluateExpression(rule, target);
					}else if(target === undefined){
						throw new Error('Could not find reference "' + firstReference + '"');
					}
					dependencies[firstReference] = target;
				}else{
					// a property reference after some other expression
					target = stack.pop();
				}
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
				var args = executingOperator.infix ?
					[stack.pop(), lastOperand] : [lastOperand];
				var result = executingOperator.apply(null, args);
				lastOperator = stack.length ? stack[stack.length-1] : undefined;
				stack.push(result);
				lastOperatorPrecedence = lastOperator && operators[lastOperator] && operators[lastOperator].precedence;
			}
		}
		if(stack.length > 1){
			throw new Error('Could not reduce expression');
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
