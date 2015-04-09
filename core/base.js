define('xstyle/core/base', [
	'xstyle/core/elemental',
	'xstyle/alkali/dom',
	'xstyle/alkali/observe',
	'xstyle/core/expression',
	'xstyle/alkali/Variable',
	'xstyle/core/Context',
	'xstyle/core/utils',
	'put-selector/put',
	'xstyle/core/Rule',
	'xstyle/alkali/lang'
], function(elemental, dom, observe, expression, Variable, Context, utils, put, Rule, lang){
	// this module defines the base definitions intrisincally available in xstyle stylesheets
	var CachingVariable = Variable.Caching;
	var testDiv = put('div');
	var ua = navigator.userAgent;
	var vendorPrefix = ua.indexOf('WebKit') > -1 ? '-webkit-' :
		ua.indexOf('Firefox') > -1 ? '-moz-' :
		ua.indexOf('MSIE') > -1 ? '-ms-' :
		ua.indexOf('Opera') > -1 ? '-o-' : '';
	// we treat the stylesheet as a 'root' rule; all normal rules are children of it
	var root = new Rule();
	var matchesRule = elemental.matchesRule;
	root.root = true;
	function elementProperty(property, rule, options){
		// variable bound to an element's property
		var variable = new CachingVariable(function(context){
			if(options.content){
				var value = getVariableProperty(property).valueOf(context);
				if (value) {
					return value;
				}
			}
			var rule = context.get('rule');
			var contentElement;
			var element = context.get('element', function(element){
				contentElement = element;
				if(options.newElement){
					// content needs to start at the parent
					element = element.parentNode;
				}
				if(rule && rule.selector){
					while(!matchesRule(element, rule)){
						element = element.parentNode;
						if(!element){
							throw new Error('Rule not found');
						}
					}
				}
				if(options.inherit){
					// we find the parent element with an item property, and key off of that 
					while(!(property in element)){
						element = element.parentNode;
						if(!element){
							throw new Error(property ? (property + ' not found') : ('Property was never defined'));
						}
					}
				}
				return element;
			});
			if(options.newElement){
				element['_' + property + 'Node'] = contentElement;
			}
			return options.get ? options.get(element, property) : element[property];
		});
		variable.define = function(rule, newProperty){
			// if we don't already have a property define, we will do so now
			return elementProperty(property || newProperty, rule, options);
		};
		// don't override content in CSS rules
		variable.keepCSSValue = true;
		variable.put = function(value, context){
			if(options.content){
				getVariableProperty(property).put(value, context, property);
			}
			// TODO: we may want to have forRule for define so that this can
			// be inherited
			// for plain element-property, we set the value on the element
			var element = context.get('element');
			var rule = context.get('rule');
			if(rule && rule.selector){
				while(!matchesRule(element, rule)){
					element = element.parentNode;
					if(!element){
						throw new Error('Rule not found');
					}
				}
			}
			if(options.set){
				options.set(element, property, value);
			}else{
				element[property] = value;
			}
			variable.invalidate(context);
		};
		return variable;
	}
	function observeExpressionForRule(rule, name, value, callback){
		return utils.when(expression.evaluate(rule, value), function(result){
			if(result.forElement){
				// we can't just set a style, we need to individually apply
				// the styles for each element
				elemental.addRenderer(rule, function(element){
					callback(result.forElement(element), element);
				});
			}else{
				callback(result);
			}
		});
	}
	function conditional(yes, no){
		return {
			apply: function(rule, args, name){
				observeExpressionForRule(rule, name, args[0], function(observable, element){
					observable.observe(function(variablePropertyValue){
						// convert to the conditional values
						variablePropertyValue = variablePropertyValue ? yes : no;
						var resolved = value.toString().replace(new RegExp(yes + '\\([^)]+\\)', 'g'), variablePropertyValue);
						if(element){
							element.style[name] = variablePropertyValue;
						}else{
							rule.setStyle(name, variablePropertyValue);
						}
					});
				});
			}
		};
	}
	var variableProperties = {};
	function getVariablePropertyValueForParent(rule, name){
		var variableProperties = rule.variableProperties;
		if(variableProperties && name in variableProperties){
			return variableProperties[name];
		}
		if(name === 'content' && rule.args){
			return expression.evaluate(rule, rule.args[0]);
		}
		var bases = rule.bases;
		if(bases){
			for(var i = 0; i < bases.length; i++){
				var result = getVariablePropertyValueForParent(bases[i], name);
				if(result !== undefined){
					return result;
				}
			}
		}
	}
	function getVariablePropertyValue(rule, name){
		do{
			var value = getVariablePropertyValueForParent(rule, name);
			if(value !== undefined){
				return value;
			}
			rule = rule.parent;
		}while(rule);
	}
	function getVariableProperty(name){
		var variableProperty = variableProperties[name];
		if(!variableProperty){
			variableProperty = variableProperties[name] = new CachingVariable(function(context){
				return getVariablePropertyValue(context.get('rule'), name);
			}, function(value, context, name){
				// assignment to a var
				var rule = context.get('rule');
				(rule.variableProperties || (rule.variableProperties = {}))[name] = value;
				var affectedRules = [];
				function addDerivatives(rule){
					affectedRules.push(rule);
					for(var name in rule.rules){
						addDerivatives(rule.rules[name]);
					}
				}
				while(rule){
					addDerivatives(rule);
					rule = rule.parent;
				}
				
			});
		}
		return variableProperty;
	}
	// the root has it's own intrinsic variableProperties that provide important base and bootstrapping functionality 
	root.definitions = {
		// useful globals to import
		Math: Math,
		window: window,
		global: window,
		module: expression.handlesReferences(function(mid, lazy){
			// require calls can be used to load in data in
			if(mid[0].value){
				// support mid as a string literal as well
				mid = mid[0].value;
			}
			if(!lazy){
				require([mid]);
			}
			return {
				valueOf: function(){
					return new lang.Promise(function(resolve){
						require([mid], function(module){
							observe(module);
							resolve(module);
						});						
					});
				}
			};
		}),
		// TODO: add url()
		// adds support for referencing each item in a list of items when rendering arrays 
		item: elementProperty('item', null, {inherit: true}),
		pageContent: new Variable(),
		// adds referencing to the prior contents of an element
		content: elementProperty('content', null, {
			content: true,
			newElement: function(){
				return this.element;
			}
		}),
		// don't define the property now let it be redefined when it is declared in another
		// this is a variable that can be redefined to use an element property as a variableProperty
		elementProperty: elementProperty(null, null, {}),
		// this is a variable that is tied to the presence or absence of a class on an element
		elementClass: elementProperty(null, null, {
			get: function(element, property){
				return (' ' + element.className + ' ').indexOf(' ' + property + ' ') > -1;
			},
			set: function(element, property, value){
				// check to see if we really need to change anything first
				if(this.get(element, property) != value){
					// set the class name
					if(value){
						// add the class name
						element.className += ' ' + property;
					}else{
						// remove it
						element.className = (' ' + element.className + ' ').replace(' ' + property + ' ', '').replace(/^ +| +$/g,'');
					}
				}
			}
		}),
		element: lang.copy(new CachingVariable(function(context){
			return context.get('element');
		}), {
			// variable to reference the actual element
			define: function(rule){
				// if it is defined, then we go from the variable
				return {
					valueOf: function(context){
						var element = context.get('element');
						while(!matchesRule(element, rule)){
							element = element.parentNode;
							if(!element){
								throw new Error('Rule not found');
							}
						}
						return element;
					}
				};
			}
		}),
		event: new Variable(),
		each: {
			put: function(value, context){
				context.get('rule').each = value;
			}
		},
		prefix: {
			put: function(value, context, name){
				// add a vendor prefix
				// check to see if the browser supports this feature through vendor prefixing
				var rule = context.get('rule');
				if(typeof testDiv.style[vendorPrefix + name] == 'string'){
					// if so, handle the prefixing right here
					rule._setStyleFromValue(vendorPrefix + name, value);
					return true;
				}
			}
		},
		// provides CSS custom property support
		'var': {
			define: function(rule, name){
				return getVariableProperty(name);
			},
			handlesReferences: true,
			apply: function(instance, args){
				// var(property) call
				return getVariableProperty(utils.convertCssNameToJs(args[0]));
			}
		},
		inline: conditional('inline', 'none'),
		block: conditional('block', 'none'),
		visible: conditional('visible', 'hidden'),
		'extends': {
			apply: function(rule, args){
				// TODO: this is duplicated in the parser, should consolidate
				for(var i = 0; i < args.length; i++){ // TODO: merge possible promises
					return utils.extend(rule, args[i], console.error);
				}
			}
		},
		set: {
			handlesContext: true,
			apply: function(target, args){
				return {
					execute: function(context){
						return args[0].put(args[1].valueOf(context), context);
					}
				};
				
			}
		},
		get: {
			apply: function(target, args){
				// just return the evaluated argument
				return args[0];
			},
			put: function(value, rule){
				// evaluate to trigger the expression
				expression.evaluate(rule, value).valueOf();
			}
		},
		toggle: {
			handlesContext: true,
			apply: function(target, args){
				return {
					execute: function(context){
						return args[0].put(!args[0].valueOf(context), context);
					}
				};
			}
		},
		on: {
			put: function(value, context, name){
				// add listener
				var rule = context.get('rule');
				dom.on(document, name.charAt(2).toLowerCase() + name.slice(3), rule,
						function(event){
					root.event.put(event);
					// execute the event listener by calling valueOf
					// note that we could define a flag on the variable to indicate that
					// we shouldn't cache it, incidently, since their are no dependencies
					// declared for this variable, it shouldn't end up being cached
					try{
						var context = new Context(rule, event.target);
						var evaluated = expression.evaluate(rule, value);
						utils.when(evaluated.execute ? evaluated.execute(context) : evaluated.valueOf(context), function(){
							root.event.put(null);
						}, function(e){
							console.error('Error in ' + name + ' event handler, executing ' + value, e);	
						});
					}catch(e){
						console.error('Error in ' + name + ' event handler, executing ' + value, e);
					}
				});
			}
		},
		title: lang.copy(new Variable(), {
			valueOf: function(){
				return document.title;
			},
			setValue: function(value){
				document.title = value;
			}
		}),
		// the primitives
		'true': true,
		'false': false,
		'null': {
			valueOf: function(){
				return null;
			}
		},
		NaN: NaN
	};
	root.elementProperty = elementProperty;
	return root;
});