define("xstyle/core/ruleModel", ["xstyle/core/elemental", "put-selector/put"], function(elemental, put){

	var nextId = 0;
	// selection of default children for given elements
	var childTagForParent = {
		"TABLE": "tr",
		"TBODY": "tr",
		"TR": "td",
		"UL": "li",
		"OL": "li",
		"SELECT": "option"
	};
	var operatorMatch = {
		'{': '}',
		'[': ']',
		'(': ')'
	}
	var doc = document, styleSheet;
	var undef, testDiv = doc.createElement("div");
	// some utility functions
	function when(value, callback){
		return value && value.then ? 
			value.then(callback) : callback(value);
	}
	function get(target, path, callback){
		return when(target, function(target){
			var name = path[0];
			if(!target){
				return callback(name || target);
			}
			if(name && target.get){
				return get(target.get(name), path.slice(1), callback);
			}
			if(target.receive){
				return target.receive(name ? function(value){
					get(value, path, callback);
				} : callback);
			}
			if(name){
				return get(target[name], path.slice(1), callback);
			}
			callback(target);
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

	var ua = navigator.userAgent;
	var vendorPrefix = ua.indexOf("WebKit") > -1 ? "-webkit-" :
		ua.indexOf("Firefox") > -1 ? "-moz-" :
		ua.indexOf("MSIE") > -1 ? "-ms-" :
		ua.indexOf("Opera") > -1 ? "-o-" : "";
	// define the Rule class		
	function Rule(){}
	Rule.prototype = {
		eachProperty: function(onProperty){
			// iterate through each property on the rule
			var values = this.values || 0;
			for(var i = 0; i < values.length; i++){
				var name = values[i];
				onProperty.call(this, name || 'unnamed', values[name]);
			}
		},
		fullSelector: function(){
			// calculate the full selector, in case this is a nested rule we determine the full selector using parent rules 
			return (this.parent ? this.parent.fullSelector() : "") + (this.selector || "") + " ";  
		},
		newRule: function(name){
			// called by the parser when a new child rule is encountered 
			return (this.rules || (this.rules = {}))[name] = new Rule();
		},
		newCall: function(name, sequence, rule){
			// called by the parser when a function call is encountered
				var call = new Call(name);
				return call; 
			},
		addSheetRule: function(selector, cssText){
//console.log('addSheetRule',selector, cssText);
			// Used to add a new rule
			if(cssText &&
				selector.charAt(0) != '@'){ // for now just ignore and don't add at-rules
				try{
					var ruleNumber = this.styleSheet.addRule(selector, cssText, this.ruleIndex);
					if(ruleNumber == -1){
						ruleNumber = this.styleSheet.cssRules.length - 1;
					}
					return styleSheet.cssRules[ruleNumber];
				}catch(e){
					console.warn("Unable to add rule", e);
				}
			}
		},
		onRule: function(){
			// called by parser once a rule is finished parsing
			this.getCssRule();
		},
		getCssRule: function(){
			if(!this.cssRule){
				this.cssRule =this.addSheetRule(this.selector, this.cssText);
			}
			return this.cssRule;
		},
		get: function(key){
			// TODO: need to add inheritance? or can this be removed
			return this.values[key];
		},
		declareProperty: function(name, value, conditional){
			// called by the parser when a variable assignment is encountered
			if(value[0].toString().charAt(0) == '>'){
				// this is used to indicate that generation should be triggered
				if(!name){
					this.generator = value;
					value = generate(value, this);
					elemental.addRenderer("", value, this, value);
					return;
				}
			}else{
				// add it to the properties for this rule
				var propertyExists = name in testDiv.style || resolveProperty(this, name);
				if(!conditional || !propertyExists){
					var properties = (this.properties || (this.properties = {}));
					properties[name] = evaluateExpression(this, name, value);
					if(propertyExists){
						console.warn('Overriding existing property "' + name + '"');
					}
				}
			}
		},
		setValue: function(name, value){
			// called by the parser when a property is encountered
			var values = (this.values || (this.values = []));
			values.push(name);
			values[name] = value;
			var calls = value.calls;
			if(calls){
				for(var i = 0; i < calls.length; i++){
					var call = calls[i];
					var handler = call.ref;
					if(handler && typeof handler.call == 'function'){
						handler.call(call, this, name, value);
					}
				}
			}
			// called when each property is parsed, and this determines if there is a handler for it
			//TODO: delete the property if it one that the browser actually uses
			// this is called for each CSS property
			if(name){
				var propertyName = name;
				do{
					// check for the handler
					var target = resolveProperty(this, name);
					if(target){
						var rule = this;
						// call the handler to handle this rule
						when(target, function(target){
							target = target.splice ? target : [target];
							for(var i = 0; i < target.length; i++){
								var segment = target[i];
								var returned = segment.put && segment.put(value, rule, propertyName);
								if(returned){
									if(returned.then){
										returned.then(function(){
											// TODO: anything we want to do after loading?
										});
									}
									break;
								}
							}
						});
						break;
					}
					// we progressively go through parent property names. For example if the 
					// property name is foo-bar-baz, it first checks for foo-bar-baz, then 
					// foo-bar, then foo
					name = name.substring(0, name.lastIndexOf("-"));
					// try shorter name
				}while(name);
			}
		},
		cssText: ""
	};
	// a class representing function calls
	function Call(value){
		// we store the caller and the arguments
		this.caller = value;
		this.args = [];
	}
	var CallPrototype = Call.prototype = new Rule;
	CallPrototype.declareProperty = CallPrototype.setValue = function(name, value){
		// handle these both as addition of arguments
		this.args.push(value);
	};
	CallPrototype.toString = function(){
		var operator = this.operator;
		return operator + this.args + operatorMatch[operator]; 
	};


	function generate(generatingSelector, rule){
		// this is responsible for generation of DOM elements for elements matching generative rules
		var id = nextId++;
		// normalize to array
		generatingSelector = generatingSelector.sort ? generatingSelector : [generatingSelector];
		// return a function that can do the generation for each element that matches
		return function(element, item){
			var lastElement = element;
			var subId = 0;
			for(var i = 0, l = generatingSelector.length;i < l; i++){
				// go through each part in the selector/generation sequence
				var part = generatingSelector[i];
				try{
					if(part.eachProperty){
						// it's a rule or call
						if(part.args){
							if(part.operator == '('){ // a call (or at least parans), for now we are assuming it is a binding
								var nextPart = generatingSelector[i+1];
								if(nextPart && nextPart.eachProperty){
									// apply the class for the next part so we can reference it properly
									put(lastElement, nextPart.selector);
								}
								// TODO: make sure we only do this only once
								var expression = part.args.toString();
								var apply = evaluateExpression(part, 0, expression);
								(function(element, lastElement){
									when(apply, function(apply){
										// TODO: assess how we could propagate changes categorically
										if(apply.forElement){
											apply = apply.forElement(lastElement);
											// now apply.element should indicate the element that it is actually keying or varying on
										}
										var textNode = element.appendChild(doc.createTextNode("Loading"));
										apply.receive(function(value){
											if(value && value.sort){
												// if it is an array, we do iterative rendering
												if(textNode){
													// remove the loading node
													textNode.parentNode.removeChild(textNode);
													textNode = null;
												}
												var eachHandler = nextPart && nextPart.eachProperty && nextPart.get('each');
												// if "each" is defined, we will use it render each item 
												if(eachHandler){
													eachHandler = generate(eachHandler, nextPart);
												}
												value.forEach(eachHandler ?
													function(value){
														// TODO: do this inside generate
														eachHandler(element, value);
													} :
													function(value){
														// if there no each handler, we use the default tag name for the parent 
														put(element, childTagForParent[element.tagName] || 'div', value);
													});
											}else{
												if("value" in element){
													// add the text
													element.value= value;
													// we are going to store the variable computation on the element
													// so that on a change we can quickly do a put on it
													// we might want to consider changing that in the future, to
													// reduce memory, but for now this probably has minimal cost
													element['-x-variable'] = apply; 
												}else{
													// put text in for Loading until we are ready
													// TODO: we should do this after setting up the receive in case we synchronously get the data 
													// if not an array, render as plain text
													textNode.nodeValue = value;
												}
											}
										}, rule, expression);
									});
								})(lastElement, element);
							}else{// brackets
								put(lastElement, part.toString());
							}
						}else{
							// it is plain rule (not a call), we need to apply the auto-generated selector, so CSS is properly applied
							put(lastElement, part.selector);
							// do any elemental updates
							elemental.update(lastElement, part.selector);
						}
					}else if(typeof part == 'string'){
						// actual CSS selector syntax, we generate the elements specified
						if(part.charAt(0) == '='){
							part = part.slice(1); // remove the '=' at the beginning					
						}
						
						var children = part.split(',');
						for(var j = 0, cl = children.length;j < cl; j++){
							var child = children[j].trim();
							var reference = null;
							if(child){
								// TODO: inline our own put-selector code, and handle bindings
								child = child.replace(/\([^)]*\)/, function(expression){
									reference = expression;
								});
								var nextElement = put(j == 0 ? lastElement : element, child);
								if(item){
									// set the item property, so the item reference will work
									nextElement.item = item;
								}
								var nextPart = generatingSelector[i + 1];
								if(nextElement != lastElement && // avoid infinite loop if it is a nop selector
									(!nextPart || !nextPart.eachProperty) // if the next part is a rule, than it should be extending it already, so we don't want to double apply
									){
									elemental.update(nextElement);
								}
								lastElement = nextElement;
							}
						}
					}else{
						// a string literal
						lastElement.appendChild(doc.createTextNode(part.value));
					}
				}catch(e){
					console.error(e, e.stack);
					lastElement.appendChild(doc.createTextNode(e));
				}
			}
			return lastElement;
		}
	}
	function evaluateExpression(rule, name, value){
		// evaluate a binding
		var binding = rule["var-expr-" + name];
		if(variables){
			return binding;
		}
		var variables = [], isElementDependent;
		variables.id = nextId++;
		var target, parameters = [], id = 0, callbacks = [],
			attributeParts, expression = value.join ? value.join("") : value.toString(),
			simpleExpression = expression.match(/^[\w_$\/\.-]*$/); 
		// Do the parsing and function creation just once, and adapt the dependencies for the element at creation time
		// deal with an array, converting strings to JS-eval'able strings
			// find all the variables in the expression
		expression = expression.replace(/("[^\"]*")|([\w_$\.\/-]+)/g, function(t, string, variable){
			if(variable){
				// for each reference, we break apart into variable reference and property references after each dot				
				attributeParts = variable.split('/');
				var parameterName = attributeParts.join('_');
				parameters.push(parameterName);
				variables.push(attributeParts);
				// first find the rule that is being referenced
				var firstReference = attributeParts[0];
				var target = resolveProperty(rule, firstReference);
				if(typeof target == 'string' || target instanceof Array){
					target = evaluateExpression(rule, firstReference, target);
				}else if(!target){
					throw new Error('Could not find reference "' + firstReference + '"');					
				}
				if(target.forElement){
					isElementDependent = true;
				}
				attributeParts[0] = target;
				// we will reference the variable a function argument in the function we will create
				return parameterName;
			}
			return t;
		})
	
		if(simpleExpression){
			// a direct reversible reference
			// no forward reactive needed
			if(name){
				// create the reverse function
				var reversal = function(element, name, value){
					when(findAttributeInAncestors(element, attributeParts[0], attributeParts[1]), function(target){
						for(var i = 2; i < attributeParts.length -1; i++){
							var name = attributeParts[i];
							target = target.get ?
								target.get(name) :
								target[name];
						}
						var name = attributeParts[i];
						if(target.set){
							target.set(name, value);
						}else{
							target[name] = value;
						}
					});
				};
				reversal.rule = rule;
//				(reversalOfAttributes[name] || (reversalOfAttributes[name] = [])).push(reversal);
			}
		}else{
			// it's a full expression, so we create a time-varying bound function with the expression
			var reactiveFunction = Function.apply(this, parameters.concat(['return xstyleReturn(' + expression + ')']));
		}
		variables.func = reactiveFunction;
		rule["var-expr-" + name] = variables;
		function getComputation(){
			var waiting = variables.length + 1;
			var values = [], callbacks = [];
			var result, isResolved;
			var done = function(i){
				return function(value){
					values[i] = value;
					waiting--;
					if(waiting <= 0){
						isResolved = true;
						result = reactiveFunction ? reactiveFunction.apply(this, values) : values[0];
						for(var j = 0; j < callbacks.length;j++){
							callbacks[j](result);
						}
					}
				};
			};
			if(reactiveFunction){
				for(var i = 0; i < variables.length; i++){
					var variable = variables[i];
					get(variable[0], variable.slice(1), done(i));
				}
			}else{
				var variable = variables[0];
				var value = {
					then: function(callback){
						callbacks.push(callback);
					}
				}
				when(variable[0], function(resolved){
					value = resolved;
					for(var j = 1; j < variable.length; j++){
						if(value && value.get){
							value = value.get(variable[j]);
						}else{
							value = {
								receive: function(callback){
									get(resolved, variable.slice(1), callback);
								},
								put: function(value){
									set(resolved, variable.slice(1), value);
								}
							};
							break;
						}
					}
					for(var j = 0; j < callbacks.length; j++){
						callbacks[j](value);
					}
				});
				return value;
				if(first && first.then){
					return {
						then: function(callback){
							get(variable[0], variable.slice(1), callback);
						}
					};
				}else{
					return variable;
				}
			}
			done(-1)();
			if(result && result.then){
				return result;
			}
			return {
				receive: function(callback){
					if(callbacks){
						callbacks.push(callback);
					}
					if(isResolved){
						callback(result);
					}
				}
			}
		}
		return rule["var-expr-" + name] = isElementDependent ? {
			forElement: function(element){
				// TODO: at some point may make this async
				var callbacks = [];
				var mostSpecificElement;
				var elementVariables = [];
				// now find the element that matches that rule, in case we are dealing with a child
				var parentElement = element;
				while(!matchesSelector.call(element, rule.selector)){
					element = element.parentNode;
				}
				for(var i = 0; i < variables.length; i++){
					var variable = variables[i];
					var target = variable[0];
					// now find the element that is keyed on
					if(target.forElement){
						target = variable[0] = target.forElement(parentElement);
					}
					// we need to find the most parent element that we need to vary on for this computation 
					var varyOnElement = target.element;
					if(parentElement != mostSpecificElement){
						while(parentElement != varyOnElement){
							if(parentElement == mostSpecificElement){
								return;
							}
							parentElement = parentElement.parentNode;
						}
						mostSpecificElement = parentElement;
					}
				}
				// make sure we indicate the store we are keying off of
				var computation = mostSpecificElement["expr-result-" + variables.id];
				if(!computation){
					mostSpecificElement["expr-result-" + variables.id] = computation = getComputation();
					computation.element = mostSpecificElement;
				}
				return computation;
			}
		} : getComputation();
	}
	function resolveProperty(rule, name, includeRules){
		var parentRule = rule;
		do{
			var target = parentRule.properties && parentRule.properties[name]
				|| (includeRules && parentRule.rules && parentRule.rules[name]);
			parentRule = parentRule.parent;
		}while(!target && parentRule);
		return target;
	}
	var hasAddEventListener = !!doc.addEventListener;
	var matchesSelector = testDiv.matches || testDiv.webkitMatchesSelector || testDiv.msMatchesSelector || testDiv.mozMatchesSelector;
	
	// we treat the stylesheet as a "root" rule; all normal rules are children of it
	var target, root = new Rule;
	root.root = true;
	// the root has it's own intrinsic variables that provide important base and bootstrapping functionality 
	root.properties = {
		Math: Math, // just useful
		module: function(mid){
			// require calls can be used to load in data in
			return {
				then: function(callback){
					require([mid], callback);
				}
			};
		},
		// TODO: add url()
		item: {
			// adds support for referencing each item in a list of items when rendering arrays 
			forElement: function(element){
				// we find the parent element with an item property, and key off of that 
				while(!element.item){
					element = element.parentNode;
				}
				return {
					element: element, // indicates the key element
					receive: function(callback){// handle requests for the data
						callback(element.item);
					}
				}
			}
		},
		prefix: {
			put: function(value, rule, name){
				// add a vendor prefix
				// check to see if the browser supports this feature through vendor prefixing
				if(typeof testDiv.style[vendorPrefix + name] == "string"){
					// if so, handle the prefixing right here
					// TODO: switch to using getCssRule, but make sure we have it fixed first
					return rule.addSheetRule(rule.selector, vendorPrefix + name +':' + value);
				}
			}
		},
		// provides CSS variable support
		'var': {
			// setting the variables
			put: function(value, rule, name){
				(rule.variables || (rule.variables = {}))[name] = value;
				// TODO: can we reuse something for this?
				var variableListeners = rule.variableListeners;
				variableListeners = variableListeners && variableListeners[name] || 0;
				for(var i = 0;i < variableListeners.length;i++){
					variableListeners[i](value);
				}
			},
			// referencing variables
			call: function(call, rule, name, value){
				this.receive(function(resolvedValue){
					rule.addSheetRule(rule.selector, name + ': ' + value.toString().replace(/var\([^)]+\)/g, resolvedValue));
				}, rule, call.args[0]);
			},
			// variable properties can also be referenced in property expressions
			receive: function(callback, rule, name){
				var parentRule = rule;
				do{
					var target = parentRule.variables && parentRule.variables[name];
					if(target){
						var variableListeners = parentRule.variableListeners || (parentRule.variableListeners = {});
						(variableListeners[name] || (variableListeners[name] = [])).push(callback);
						return callback(target);
					}
					parentRule = parentRule.parent;
				}while(parentRule);
				callback();
			}
		},
		on: {
			put: function(value, rule, name){
				// apply event listening
				var on = this.on;
				// first evaluate value as expression
				get(evaluateExpression(rule, name, value), 0, function(value){
					// add listener	
					on(document, name.slice(3), rule.selector, value);
				});
			},
			on: function(target, event, selector, listener){
				// this function can be overriden to provide better event handling
				hasAddEventListener ? 
					target.addEventListener(event, select, false) :
					target.attachEvent(event, select);
				function select(event){
					// do event delegation
					selector = selector || rule.fullSelector();
					if(matchesSelector.call(event.target, selector)){
						listener(event);	
					}
				}
			}
			
		}
	};
	xstyleReturn = function(first){
		// global function used by the reactive functions to separate out comma-separated expressions into an array
		if(arguments.length == 1){
			// one arg, just return that
			return first;
		}
		// if it is a comma separated list of values, return them as an array
		return [].slice.call(arguments);
	};
	root.setStyleSheet = function(nextStyleSheet){
		styleSheet = nextStyleSheet;
	};
	root.resolveProperty = resolveProperty;
	return root;	
});