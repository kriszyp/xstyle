define('xstyle/core/base', [
	'xstyle/core/elemental',
	'xstyle/core/expression',
	'xstyle/core/utils',
	'put-selector/put',
	'xstyle/core/Rule',
	'dojo/Deferred',
	'xstyle/core/Proxy'
], function(elemental, expression, utils, put, Rule, Deferred, Proxy){
	// this module defines the base definitions intrisincally available in xstyle stylesheets
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
	function elementProperty(property, rule, inherit, newElement){
		// definition bound to an element's property
		// TODO: allow it be bound to other names, and use prefixing to not collide with element names
		return {
			forElement: function(element, directReference){
				var contentElement = element;
				if(newElement){
					// content needs to start at the parent
					element = element.parentNode;
				}
				if(rule){
					while(!element.matches(rule.selector)){
						element = element.parentNode;
						if(!element){
							throw new Error('Rule not found');
						}
					}
				}
				if(inherit){
					// we find the parent element with an item property, and key off of that 
					while(!(property in element)){
						element = element.parentNode;
						if(!element){
							throw new Error(property ? (property + ' not found') : ('Property was never defined'));
						}
					}
				}
				// provide a means for being able to reference the target node,
				// this primarily used by the generate model to nest content properly
				if(directReference){
					element['_' + property + 'Node'] = contentElement;
				}
				var value = element[property];
				if(!value){
					value = element[property] = new Proxy(null);
				}else if(!value.observe){
					value = new Proxy(value);
				}
				value.element = element;
				value.newElement = newElement;
				return value;
			},
			define: function(rule, newProperty){
				// if we don't already have a property define, we will do so now
				return elementProperty(property || newProperty, rule, newElement);
			},
			put: function(value){
				elemental.addRenderer(function(element){
					var proxy = element[property];
					if(proxy && proxy.put){
						proxy.put(value);
					}else{
						element[property] = new Proxy(value);
					}
				});
			}
		};
	}
	function observeExpressionForRule(rule, name, value, callback){
		var result = expression.evaluate(rule, value);
		if(result.forElement){
			// we can't just set a style, we need to individually apply
			// the styles for each element
			elemental.addRenderer(rule, function(element){
				callback(result.forElement(element), element);
			});
		}else{
			callback(result);
		}
	}
	function conditional(yes, no){
		return {
			apply: function(rule, args, name){
				observeExpressionForRule(rule, name, args[0], function(observable, element){
					observable.observe(function(variableValue){
						// convert to the conditional values
						variableValue = variableValue ? yes : no;
						var resolved = value.toString().replace(new RegExp(yes + '\\([^)]+\\)', 'g'), variableValue);
						if(element){
							element.style[name] = variableValue;
						}else{
							rule.setStyle(name, variableValue);
						}
					});
				});
			}
		};
	}
	function deriveVar(rule, name, ifExists){
		// when we beget a var, we basically are making a property that is included in variables
		// object for the parent object
		var variables = (rule.variables || (!ifExists && (rule.variables = new Proxy())));
		var proxy;
		if(ifExists){
			proxy = variables && variables._properties[name];
			if(!proxy){
				return this;
			}
		}else{
			proxy = variables.property(name);
		}
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
		proxy.define = deriveVar;
		proxy.forParent = deriveVar;
		return proxy;
	}
	// the root has it's own intrinsic variables that provide important base and bootstrapping functionality 
	root.definitions = {
		// useful globals to import
		Math: Math,
		window: window,
		global: window,
		module: expression.selfResolving(function(mid, lazy){
			// require calls can be used to load in data in
			if(mid[0].value){
				// support mid as a string literal as well
				mid = mid[0].value;
			}
			if(!lazy){
				require([mid]);
			}
			return {
				then: function(callback){
					var deferred = new Deferred();
					require([mid], function(module){
						deferred.resolve(callback(module));
					});
					return deferred.promise;
				}
			};
		}),
		// TODO: add url()
		// adds support for referencing each item in a list of items when rendering arrays 
		item: elementProperty('item', null, true),
		'page-content': elementProperty('page-content', {selector: 'body'}, true),
		// adds referencing to the prior contents of an element
		content: elementProperty('content', null, true, function(target){
			this.element;
		}),
		// don't define the property now let it be redefined when it is declared in another
		// definition
		'element-property': elementProperty(),
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
			},
			valueOf: function(){
				return currentEvent;
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
							rule._setStyleFromValue(vendorPrefix + name, value);
							return true;
						}
					}
				};
			}
		},
		// provides CSS variable support
		'var': derive(new Proxy(), {
			define: deriveVar,
			forParent: deriveVar,
			// referencing variables
			apply: function(rule, args){
				return this.forParent(rule, args[0]);
			}
		}),
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
		set: expression.contextualized(function(target, value){
			target.put(value);
		}),
		get: expression.resolved(function(value){
			return value;
		}),
		on: {
			forParent: function(rule, name){
				return {
					put: function(value){
						// add listener
						elemental.on(document, name.slice(3), rule.selector, function(event){
							currentEvent = event;
							// TODO: might consider this putting in a separate 'realize()' function
							utils.when(expression.evaluate(rule, value), function(computation){
								currentEvent = event;
								if(computation && computation.forElement){
									computation = computation.forElement(event.target);
								}
								if(computation && computation.observe){
									// trigger observe, if it has one
									computation = computation.observe(function(){});
								}
								computation && computation.stop && computation.stop();
								computation && computation.remove && computation.remove();
								currentEvent = null;
							});
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
		},
		// the primitives
		'true': true,
		'false': false,
		'null': null
	};
	root.elementProperty = elementProperty;
	return root;
});