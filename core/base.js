define('xstyle/core/base', [
	'xstyle/core/elemental',
	'xstyle/core/expression',
	'xstyle/core/utils',
	'put-selector/put',
	'xstyle/core/Rule',
	'xstyle/core/Proxy'
], function(elemental, evaluateExpression, utils, put, Rule, Proxy){
	// this module defines the base definitions intrisincally available in xstyle stylesheets
	var truthyConversion = {
		'': 0,
		'false': 0,
		'true': 1
	};
	var styleSubstitutes = {
		display: ['none',''],
		visibility: ['hidden', 'visible'],
		'float': ['none', 'left']
	};
	var testDiv = put('div');
	var ua = navigator.userAgent;
	var vendorPrefix = ua.indexOf('WebKit') > -1 ? '-webkit-' :
		ua.indexOf('Firefox') > -1 ? '-moz-' :
		ua.indexOf('MSIE') > -1 ? '-ms-' :
		ua.indexOf('Opera') > -1 ? '-o-' : '';
	function derive(base, mixin){
		var derived = Object.create(base);
		for(var i in mixin){
			derived[i] = mixin[i];
		}
		return derived;
	}
	// we treat the stylesheet as a 'root' rule; all normal rules are children of it
	var currentEvent;
	var root = new Rule();
	root.root = true;
	function elementProperty(property, appendTo){
		// definition bound to an element's property
		// TODO: allow it be bound to other names, and use prefixing to not collide with element names
		return {
			forElement: function(element, directReference){
				var contentElement = element;
				if(appendTo){
					// content needs to start at the parent
					element = element.parentNode;
				}
				// we find the parent element with an item property, and key off of that 
				while(!(property in element)){
					element = element.parentNode;
					if(!element){
						throw new Error(property + ' not found');
					}
				}
				// provide a means for being able to reference the target node,
				// this primarily used by the generate model to nest content properly
				if(directReference){
					element['_' + property + 'Node'] = contentElement;
				}
				var value = element[property];
				if(!value){
					value = element[property] = new Proxy();
				}else if(!value.observe){
					value = new Proxy(value);
				}
				value.element = element;
				value.appendTo = appendTo;
				return value;
				return {
					element: element, // indicates the key element
					observe: function(callback, rule){// handle requests for the data
						var elementValue;
						// get the value from the element
						(element[property] || (element[property] = new Proxy())).observe(function(value){
							callback(elementValue = value);
						});
						if(elementValue === undefined && rule){
							// else fallback to getting the value from the rule
							rule.property(property).observe(function(value){
								if(elementValue == undefined){
									callback(value);
								}
							});
						}
					},
					put: function(value){
						return element[property].put(value);
					},
					appendTo: appendTo
				};
			},
			forParent: function(rule, name){
				return new Proxy();
			}
		};
	}
	// the root has it's own intrinsic variables that provide important base and bootstrapping functionality 
	root.definitions = {
		Math: Math, // just useful
		module: function(mid, lazy){
			// require calls can be used to load in data in
			if(!lazy){
				require([mid]);
			}
			return {
				then: function(callback){
					require([mid], callback);
				}
			};
		},
		// TODO: add url()
		// adds support for referencing each item in a list of items when rendering arrays 
		item: elementProperty('item'),
		'page-content': elementProperty('page-content'),
		// adds referencing to the prior contents of an element
		content: elementProperty('content', function(target){
			target.appendChild(this.element);
		}),
		element: {
			// definition to reference the actual element
			forElement: function(element){
				return {
					element: element, // indicates the key element
					observe: function(callback){// handle requests for the data
						callback(element);
					},
					get: function(property){
						return this.element[property];
					}
				};
			}
		},
		event: {
			observe: function(callback){
				callback(currentEvent);
			}
		},
		each: {
			forParent: function(rule){
				return {
					put: function(value){
						rule.each = value;
					}
				};
			}
		},
		prefix: {
			forParent: function(rule, name){
				return {
					put: function(value){
						// add a vendor prefix
						// check to see if the browser supports this feature through vendor prefixing
						if(typeof testDiv.style[vendorPrefix + name] == 'string'){
							// if so, handle the prefixing right here
							// TODO: switch to using getCssRule, but make sure we have it fixed first
							rule.setStyle(vendorPrefix + name, value);
							return true;
						}
					}
				};
			}
		},
		// provides CSS variable support
		'var': derive(new Proxy(), {
			forParent: function(rule, name){
				// when we beget a var, we basically are making a propery that is included in variables
				// object for the parent object
				var variables = (rule.variables || (rule.variables = new Proxy()));
				var proxy = variables.property(name);
				var varObject = this;
				proxy.observe = function(listener){
					// modify observe to inherit values from parents as well
					var currentValue;
					Proxy.prototype.observe.call(proxy, function(value){
						currentValue = value;
						listener(value);
					});
					if(currentValue === undefined && rule.parent){
						varObject.forParent(rule.parent, name).observe(function(value){
							if(currentValue === undefined){
								listener(value);
							}
						});
					}
				};
				proxy.valueOf = function(){
					var value = variables[name];
					if(value !== undefined){
						return value;
					}
					if(rule.parent){
						return varObject.forParent(rule.parent, name).valueOf();
					}
				};
				return proxy;
			},
			// referencing variables
			call: function(call, rule, name, value){
				this.forParent(rule, call.args[0]).observe(function(resolvedValue){
					var resolved = value.toString().replace(/var\([^)]+\)/g, resolvedValue);
					// now check if the value if we should do subsitution for truthy values
					var truthy = truthyConversion[resolved];
					if(truthy > -1){
						var substitutes = styleSubstitutes[name];
						if(substitutes){
							resolved = substitutes[truthy];
						}
					}
					rule.setStyle(name, resolved);
				});
			}
		}),
		'extends': {
			call: function(call, rule){
				// TODO: this is duplicated in the parser, should consolidate
				var args = call.args;
				for(var i = 0; i < args.length; i++){ // TODO: merge possible promises
					return utils.extend(rule, args[i], console.error);
				}
			}
		},
		on: {
			forParent: function(rule, name){
				return {
					put: function(value){
						// add listener
						elemental.on(document, name.slice(3), rule.selector, function(event){
							currentEvent = event;
							var computation = evaluateExpression(rule, name, value);
							if(computation.forElement){
								computation = computation.forElement(event.target);
							}
							computation && computation.stop && computation.stop();
							currentEvent = null;
						});
					}
				};
			}
		},
		'@supports': {
			selector: function(rule){
				function evaluateSupport(expression){
					var parsed;
					if(parsed = expression.match(/^\s*not(.*)/)){
						return !evaluateSupport(parsed[1]);
					}
					if(parsed = expression.match(/\((.*)\)/)){
						return evaluateSupport(parsed[1]);
					}
					if(parsed = expression.match(/([^:]*):(.*)/)){
						// test for support for a property
						var name = utils.convertCssNameToJs(parsed[1]);
						var value = testDiv.style[name] = parsed[2];
						return testDiv.style[name] == value;
					}
					if(parsed = expression.match(/\w+\[(.*)=(.*)\]/)){
						// test for attribute support
						return put(parsed[0])[parsed[1]] == parsed[2];
					}
					if(parsed = expression.match(/\w+/)){
						// test for attribute support
						return utils.isTagSupported(parsed);
					}
					throw new Error('can\'t parse @supports string');
				}
				
				if(evaluateSupport(rule.selector.slice(10))){
					rule.selector = '';
				}else{
					rule.disabled = true;
				}
			}
		}
	};
	return root;
});