define('xstyle/core/Rule', [
	'xstyle/core/expression',
	'put-selector/put',
	'xstyle/core/utils',
	'xstyle/core/Proxy'
], function(expression, put, utils, Proxy){

	// define the Rule class, our abstraction of a CSS rule		
	var create = Object.create || function(base){
		function Base(){}
		Base.prototype = base;
		return new Base();
	};

	var operatorMatch = {
		'{': '}',
		'[': ']',
		'(': ')'
	};
	var observe = expression.observe;
	var testStyle = put('div').style;
	function Rule(){}
	Rule.prototype = {
		property: function(key){
			// basic property implementation to match the reactive/dstore API
			return (this._properties || (this._properties = {}))[key] || (this._properties[key] = new Proxy(this.get(key)));
		},
		eachProperty: function(onProperty){
			// iterate through each property on the rule
			var values = this.values || 0;
			for(var i = 0; i < values.length; i++){
				var name = values[i];
				onProperty.call(this, name || 'unnamed', values[name]);
			}
		},
		fullSelector: function(){
			// calculate the full selector, in case this is a nested rule we
			// determine the full selector using parent rules 
			return (this.parent ? this.parent.fullSelector() : '') + (this.selector || '') + ' ';
		},
		newRule: function(name){
			// called by the parser when a new child rule is encountered 
			var rule = (this.rules || (this.rules = {}))[name] = new Rule();
			rule.disabled = this.disabled;
			return rule;
		},
		newCall: function(name){
			// called by the parser when a function call is encountered
			var call = new Call(name);
			return call;
		},
		addSheetRule: function(selector, cssText){
			// Used to add a new rule
			if(cssText &&
				selector.charAt(0) != '@'){ // for now just ignore and don't add at-rules
				var styleSheet = this.styleSheet;
				var cssRules = styleSheet.cssRules || styleSheet.rules;
				var ruleNumber = this.ruleIndex > -1 ? this.ruleIndex : cssRules.length;
				styleSheet.addRule(selector, cssText, ruleNumber);
				return cssRules[ruleNumber];
			}
		},
		onRule: function(){
			// called by parser once a rule is finished parsing
			var cssRule = this.getCssRule();
			if(this.installStyles){
				for(var i = 0; i < this.installStyles.length;i++){
					var pair = this.installStyles[i];
					cssRule.style[pair[0]] = pair[1];
				}
			}
		},
		setStyle: function(name, value){
			if(this.cssRule){
				this.cssRule.style[name] = value;
			}/*else if('ruleIndex' in this){
				// TODO: inline this
				this.getCssRule().style[name] = value;
			}*/else{
				(this.installStyles || (this.installStyles = [])).push([name, value]);
			}
		},
		getCssRule: function(){
			if(!this.cssRule){
				this.cssRule = this.addSheetRule(this.selector, this.cssText);
			}
			return this.cssRule;
		},
		get: function(key){
			// TODO: need to add inheritance? or can this be removed
			return this.values[key];
		},
		elements: function(callback){
			var rule = this;
			require(['xstyle/core/elemental'], function(elemental){
				elemental.addRenderer(rule, function(element){
					callback(element);
				});
			});
		},
		declareDefinition: function(name, value, conditional){
			// called by the parser when a variable assignment is encountered
			// this creates a new definition in the current rule
			if(this.disabled){
				return;
			}
			var rule = this;
			if(value.length){
				if(value[0].toString().charAt(0) == '>'){
					// this is used to indicate that generation should be triggered
					if(!name){
						this.generator = value;
						require(['xstyle/core/generate', 'xstyle/core/elemental'], function(generate, elemental){
							value = generate.forSelector(value, rule);
							elemental.addRenderer(rule, value);
						});
						return;
					}
				}else{
					// add it to the definitions for this rule
					var propertyExists = name in testStyle || this.getDefinition(name);
					if(!conditional || !propertyExists){
						var definitions = (this.definitions || (this.definitions = {}));
						var first = value[0];
						if(first.indexOf && first.indexOf(',') > -1){
							// handle multiple values
							var parts = value.join('').split(/\s*,\s*/);
							var definition = [];
							for(var i = 0;i < parts.length; i++){
								definition[i] = expression.evaluate(this, parts[i]);
							}
						}
						if(value[0] && value[0].operator == '{'){ // see if it is a rule
							definition = value[0];
						}else if(value[1] && value[1].operator == '{'){
							definition = value[1];
						}
						definition = definition || expression.evaluate(this, value);
						if(definition.then){
							// if we have a promise, create a new one to maintain lazy activation
							// and still check for a define function
							var originalDefinition = definition;
							definition = {
								then: function(callback){
									return originalDefinition.then(function(definition){
										return callback(applyDefine(definition));
									});
								}
							};
						}
						var applyDefine = function(definition){
							if(definition.define){
								definition = definition.define(rule, name);
							}
							return definition;
						};
						definitions[name] = applyDefine(definition);
						if(propertyExists){
							console.warn('Overriding existing property "' + name + '"');
						}
					}
				}
			}else{
				var definitions = (this.definitions || (this.definitions = {}));
				definitions[name] = value;
			}
		},
		onArguments: function(call, name){
			var handler = call.ref;
			// call the target with the parsed arguments
			return handler && handler.apply(this, call.getArgs(), name);
		},
		setValue: function(name, value, scopeRule){
			// called by the parser when a property is encountered
			if(this.disabled){
				// TODO: eventually we need to support reenabling
				return;
			}
			var values = (this.values || (this.values = []));
			values.push(name);
			values[name] = value;
			// called when each property is parsed, and this determines if there is a handler for it
			// this is called for each CSS property
			if(name){
				var propertyName = name;
				do{
					// check for the handler
					var target = (scopeRule || this).getDefinition(name);
					if(target !== undefined){
						if(this.cssRule){
							// delete the property if it one that the browser actually uses
							var thisStyle = this.cssRule.style;
							if(name in thisStyle){
								thisStyle[name] = '';
							}
						}
						var rule = this;
						return utils.when(target, function(target){
							// call the handler to handle this rule
							target = target.splice ? target : [target];
							for(var i = 0; i < target.length; i++){
								var segment = target[i];
								var returned;
								utils.when(segment, function(segment){
									var newProperty = segment.forParent ?
										segment.forParent(rule, propertyName) :
										segment;
									returned = newProperty.put(value);
								});
								if(returned){
									return returned;
								}
							}
						});
					}
					// we progressively go through parent property names. For example if the 
					// property name is foo-bar-baz, it first checks for foo-bar-baz, then 
					// foo-bar, then foo
					name = name.substring(0, name.lastIndexOf('-'));
					// try shorter name
				}while(name);
			}
			if(propertyName in testStyle){
				// if we don't have a handler, and this is a CSS property, we may need to
				// setup reactive bindings
				this._setStyleFromValue(propertyName, value, true);
			}
		},
		_setStyleFromValue: function(propertyName, value, alreadySet){
			// This sets a CSS rule property from an unevaluated value
			var first = value[0];
			if(first instanceof Rule){
				// nested rule, that we can apply to sub-properties
				var values = first.values;
				for(var i = 0; i < values.length; i++){
					var key = values[i];
					this._setStyleFromValue(propertyName + (key == 'main' ? '' : '-' + key), values[key]);
				}
				return;
			}
			var calls = value.calls;
			if(calls){
				var rule = this;
				var result = evaluateText(value, this, propertyName, true);
				// if there were new computed values, update this style
				if(result){
					if(result.forElement){
						// the value is dependent on the element, so we need to do element
						// specific rendering
						return require(['xstyle/core/elemental'], function(elemental){
							elemental.addRenderer(rule, function(element){
								observe(result.forElement(element), function(value){
									element.style[propertyName] = value;
								});
							});
						});
					}else{
						// otherwise we can just do live updates to the CSS rule
						return observe(result, function(value){
							rule.setStyle(propertyName, value);
						});
					}
				}
			}
			if(!alreadySet){
				this.setStyle(propertyName, value);
			}
		},
		forParent: function(rule){
			// rules can be used as properties, in which case they act as mixins
			// first extend
			this.extend(rule);
			var base = this;
			return {
				put: function(value){
					if(value == 'defaults'){
						// this indicates that we should leave the mixin properties as is.
						return;
					}
					if(value && typeof value == 'string' && base.values){
						// then apply properties with comma delimiting
						var parts = value.toString().split(/,\s*/);
						for(var i = 0; i < parts.length; i++){
							// TODO: take the last part and don't split on spaces
							var name = base.values[i];
							name && rule.setValue(name, parts[i], base);
						}
					}
				}
			};
		},
		extend: function(derivative, fullExtension){
			// we might consider removing this if it is only used from put
			var base = this;
			var newText = base.cssText;
			var extraSelector = base.extraSelector;
			if(extraSelector){
				// need to inherit any extra selectors by adding them to our selector
				derivative.selector += extraSelector;
			}
			if(derivative.cssRule){
				// already have a rule, we use a different mechanism here
				var baseStyle = base.cssRule.style;
				var derivativeStyle = derivative.cssRule.style;
				var inheritedStyles = derivative.inheritedStyles || (derivative.inheritedStyles = {});
				// now we iterate through the defined style properties, and copy them to the derivitative
				for(var i = 0; i < baseStyle.length; i++){
					var name = baseStyle[i];
					// if the derivative has a style, we assume it is set in the derivative rule. If we 
					// inherit a rule, we have to mark it as inherited so higher precedence rules
					// can override it without thinking it came from the derivative. 
					if(!derivativeStyle[name] || inheritedStyles[name]){
						derivativeStyle[name] = baseStyle[name];
						inheritedStyles[name] = true;
					}
				}
			}else{
				derivative.cssText += newText;
			}
			'values,variables,calls'.replace(/\w+/g, function(property){
				var set = base[property];
				if(set){
					// TODO: need to mixin this in, if it already exists
					derivative[property] = create(set);
				}
			});
			if(fullExtension){
				var definitions = base.definitions;
				if(definitions){
					// TODO: need to mixin this in, if it already exists
					derivative.definitions = create(definitions);
				}
				derivative.tagName = base.tagName || derivative.tagName;
			}
			derivative.base = base;
			
	//		var ruleStyle = derivative.getCssRule().style;
			base.eachProperty(function(name, value){
				if(typeof value == 'object'){
					// make a derivative on copy
					value = create(value);
				}
				derivative.setValue(name, value);
		/*		if(name){
					name = convertCssNameToJs(name);
					if(!ruleStyle[name]){
						ruleStyle[name] = value;
					}
				}*/
			});
			if(base.generator){
				derivative.declareDefinition(null, base.generator);
			}
		},
		getDefinition: function(name, extraScope){
			// lookup a definition by name, which used for handling properties and other things
			var parentRule = this;
			do{
				var target = (parentRule.definitions && parentRule.definitions[name]);
				if(target === undefined && extraScope && parentRule[extraScope]){
					target = parentRule[extraScope][name];
				}
				parentRule = parentRule.parent;
			}while(target === undefined && parentRule);
			return target;
		},
		newElement: function(){
			return put((this.tagName || 'span') + (this.selector || ''));
		},
		cssText: ''
	};

	expression.evaluateText = evaluateText;
	function evaluateText(sequence, rule, name, onlyReturnEvaluated){
		var calls = sequence.calls;
		if(calls){
			var evaluatedCalls;
			for(var i = 0; i < sequence.length; i++){
				var part = sequence[i];
				if(part instanceof Call){
					if(!sequence.hasOwnProperty(i)){
						// it is derivative part, make a derivative call
						sequence[i] = part = create(part);
					}
					// evaluate each call
					var evaluated = part.ref && part.ref.apply(rule, part.getArgs(), name);
					if(evaluated !== undefined){
						(evaluatedCalls || (evaluatedCalls = [])).push(evaluated);
						part.evaluated = true;
					}
				}
			}
		}
		if(evaluatedCalls){
			// react to the evaluated sequences
			var computation = expression.react(function(){
				var j = 0;
				var computedValue = sequence.slice();
				for(var i = 0; i < sequence.length; i++){
					var part = sequence[i];
					if(part instanceof Call && part.evaluated){
						// remove the caller string
						computedValue[i-1] = sequence[i-1].slice(0, -part.caller.length);
						// insert the current value
						computedValue[i] = arguments[j++];
					}
				}
				// now piece it together as a string
				return computedValue.join('');
			});
			computation.skipResolve = true;
			return computation.apply(this, evaluatedCalls);
		}
		if(!onlyReturnEvaluated){
			return sequence.toString();
		}
	}
	// a class representing function calls
	function Call(value){
		// we store the caller and the arguments
		this.caller = value;
		this.args = [];
	}
	var CallPrototype = Call.prototype = new Rule();
	CallPrototype.declareDefinition = CallPrototype.setValue = function(name, value){
		// handle these both as addition of arguments
		this.args.push(value);
	};
	CallPrototype.toString = function(){
		var operator = this.operator;
		return operator + this.args + operatorMatch[operator];
	};
	return Rule;
});