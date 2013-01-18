if(typeof define == "undefined"){
	(function(){
		// pseudo passive loader
		var modules = {};
		define = function(id, deps, factory){
			for(var i = 0;i < deps.length; i++){
				deps[i] = modules[deps[i]];
			}
			modules[id] = factory.apply(this, deps);
		};
		require = function(deps){
			define("", deps, factory);
		};
	})();
}
define("xstyle/xstyle", ["require", "put-selector/put"], function (require, put) {
	"use strict";
	var cssScan = /\s*([^{\}\(\)\/\\'":=;]*)([=:]\s*([^{\}\(\)\/\\'";]*))?([{\}\(\)\/\\'";]|$)/g;
									// name: value 	operator
	var singleQuoteScan = /((?:\\.|[^'])*)'/g;
	var doubleQuoteScan = /((?:\\.|[^"])*)"/g;
	var commentScan = /\*\//g;
	var nextId = 0;
	var globalAttributes = {Math:Math, require: function(mid){
		return {
			then: function(callback){
				require([mid], callback);
			}
		};
	}};
	var undef, testDiv = document.createElement("div");
	function search(tag){
		var elements = document.getElementsByTagName(tag);
		for(var i = 0; i < elements.length; i++){
			checkImports(elements[i]);
		}
	}
	function toStringWithoutCommas(){
		return this.join('');
	}
	function arrayWithoutCommas(array){
		array.toString = toStringWithoutCommas;
		return array;
	}
	function LiteralString(string){
		this.value = string; 
	}
	LiteralString.prototype.toString = function(){
		return JSON.stringify(this.value);
	}
	var ua = navigator.userAgent;
	var vendorPrefix = ua.indexOf("WebKit") > -1 ? "-webkit-" :
		ua.indexOf("Firefox") > -1 ? "-moz-" :
		ua.indexOf("MSIE") > -1 ? "-ms-" :
		ua.indexOf("Opera") > -1 ? "-o-" : "";
	function checkImports(element, callback, fixedImports){
		var sheet = element.sheet || element.styleSheet;
		var needsParsing = sheet.needsParsing, // load-imports can check for the need to parse when it does it's recursive look at imports 
			cssRules = sheet.rules || sheet.cssRules;
		function fixImports(){
			// need to fix imports, applying load-once semantics for all browsers, and flattening for IE to fix nested @import bugs
			require(["./load-imports"], function(load){
				load(element, function(){
					checkImports(element, callback, true);
				});
			});
		}
		if(sheet.imports && !fixedImports && sheet.imports.length){
			// this is how we check for imports in IE
			return fixImports();
		}
		if(!needsParsing){
			for(var i = 0; i < cssRules.length; i++){								
				var rule = cssRules[i];
				if(rule.href && !fixedImports){
					// it's an import (for non-IE browsers)
					return fixImports();
				}
				if(rule.selectorText && rule.selectorText.substring(0,2) == "x-"){
					// an extension is used, needs to be parsed
					needsParsing = true;
					if(/^'/.test(rule.style.content)){
						// this means we are in a built sheet, and can directly parse it
						// TODO: parse here
					}
				}
			}
		}
		if(needsParsing){
			// ok, determined that CSS extensions are in the CSS, need to get the source and really parse it
			parse(sheet.localSource || sheet.ownerElement.innerHTML, sheet, callback);
		}
	}
	function parse(textToParse, styleSheet, callback) {
		// normalize the stylesheet.
		if(!styleSheet.addRule){
			// only FF doesn't have this
			styleSheet.addRule = function(selector, style, index){
				return this.insertRule(selector + "{" + style + "}", index >= 0 ? index : this.cssRules.length);
			}
		}
		if(!styleSheet.deleteRule){
			styleSheet.deleteRule = styleSheet.removeRule;
		}
	
	
		var handlers = {property:{}};
		function addHandler(type, name, module){
			var handlersForType = handlers[type] || (handlers[type] = {});
			handlersForType[name] = module;
		}
		function addExtensionHandler(type){
			if(!handlers[type]){
				handlers[type] = {};
			}
			addHandler("selector", 'x-' + type, {
				onRule: function(rule){
					rule.eachProperty(function(name, value){
						var asString = value.toString();
						do{
							var parts = asString.match(/([^, \(]+)(?:[, ]+(.+))?/);
							if(!parts){
								return;
							}
							var first = parts[1];
							if(first == 'require'){
								return addHandler(type, name, value[1].args[0]);
							}if(first == "default"){
								if((type == "property" && typeof testDiv.style[name] == "string")){
									return;
								}
								if(type == "pseudo"){
									try{
										document.querySelectorAll("x:" + name);
										return;
									}catch(e){}
								}
							}else if(first == "prefix"){
								if(typeof testDiv.style[vendorPrefix + name] == "string"){
									return addHandler(type, name, 'xstyle/xstyle');
								}
							}else{
								return addHandler(type, name, function(){
									return value;
								});
							}
						}while(asString = parts[2]);
	/*						var ifUnsupported = value.charAt(value.length - 1) == "?";
							value = value.replace(/require\s*\(|\)\??/g, '');
							if(!ifUnsupported || typeof testDiv.style[name] != "string"){ // if conditioned on support, test to see browser has that style
								// not supported as a standard property, now let's check to see if we can support it with vendor prefixing
								if(ifUnsupported && typeof testDiv.style[vendorPrefix + name] == "string"){
									// it does support vendor prefixing, fix it with that
									value = 'xstyle/xstyle';
								}
								addHandler(type, name, value);
							}*/
					});
				}
			});
		}
		addExtensionHandler("property");
		addExtensionHandler("function");
		addExtensionHandler("pseudo");
		var waiting = 1;
		var baseUrl = (styleSheet.href || location.href).replace(/[^\/]+$/,'');
		var properties = [], values = [];
		var valueModules = {};
		
		var convertedRules = [];
		var valueRegex = new RegExp("(?:^|\\W)(" + values.join("|") + ")(?:$|\\W)");
		function Rule(){}
		Rule.prototype = {
			eachProperty: function(onProperty){
				var properties = this.properties || 0;
				for(var i = 0; i < properties.length; i++){
					var name = properties[i];
					onProperty(name || 'unnamed', properties[name]);
				}
			},
			fullSelector: function(){
				return (this.parent ? this.parent.fullSelector() : "") + (this.selector || "") + " ";  
			},
			newRule: function(name){
				return (this.rules || (this.rules = {}))[name] = new Rule();
			},
			newCall: function(name){
				return new Call(name);
			},
			addSheetRule: function(selector, cssText){
console.log("add", selector, cssText);
				if(cssText){
					styleSheet.addRule ?
						styleSheet.addRule(selector, cssText) :
						styleSheet.insertRule(selector + '{' + cssText + '}', styleSheet.cssRules.length);
				}
			},
			onRule: function(){
				if(!this.parent.root){
					this.addSheetRule(this.selector, this.cssText);
				}
			},
			recomputeAttribute: function(element, name){
				this.attributeFunctions[name](element);
			},
			get: function(key){
				// TODO: need to add inheritance?
				return this.properties[key];
			},
			addAttribute: function(name, value){
				if(value[0].toString().charAt(0) == '>'){
					value = generate(value, this);
					if(!name){
						xstyle.addRenderer("", value, this, value);
						return;
					}
				}else if(name){
					var target, variables = [], id = 0, variableLength = 0, callbacks = [],
					parameterized = false;
					var expression = [];
					var parts = value.sort ? value : [value];
					// Do the parsing and function creation just once, and adapt the dependencies for the element at creation time
					// deal with an array, converting strings to JS-eval'able strings
					for(var i = 0;i < parts.length;i++){
						var part = parts[i];
						// find all the variables in the expression
						part.toString().replace(/("[^\"]*")|([a-zA-Z_$][\w_$\.]*)/g, function(t, string, variable){
							if(variable){
								// for each reference, we break apart into variable reference and property references after each dot
								var parts = variable.split('.');
								variables.push(parts[0]);
								// we will reference the variable a function argument in the function we will create
							}
						})
					}
					expression = parts.join('');
					if(expression.length > variableLength){
						// it's a full expression, so we create a time-varying bound function with the expression
						var reactiveFunction = Function.apply(null, variables.concat(['return ' + expression]));
					}
				}
				var rule = this; // TODO: can this be passed by addRenderer?
				xstyle.addRenderer(name, value, this, function(element){
					var satisfied = [];
					function recompute(element, setupRule){
						var waiting = 1;
						for(var i = 0; i < variables.length; i++){
							// TODO: add support for promises
							var value = findAttributeInAncestors(element, variables[i], setupRule);
/*							for(var j = 1; j < parts.length; j++){
								value = value && (value.get ? value.get(part[i]) : value[parts[i]]);
							}*/
							if(value && value.then){
								waiting++;
								(function(i){
									value.then(function(value){
										satisfied[i] = value;
										done();
									});
								})(i);
							}
							satisfied[i] = value;
						}
						var callbacks = [];
						done(value);
						function done(value){
							if(--waiting == 0){
								value = reactiveFunction ? reactiveFunction.apply(this, satisfied) : value;
							}
							for(var i = 0; i < callbacks.length; i++){
								callbacks[i](value);
							}
							element[name] = value;
						}
						if(waiting != 0){
							element[name] = {
								then: function(callback){
									callbacks.push(callback);
								},
								toString: function(){
									return "Loading";
								}
							}
						}
					}
					recompute(element, rule);
					(rule.attributeFunctions || (rule.attributeFunctions = {}))[name] = recompute;
					/*var each = findAttributeInAncestors(element, "eachFunction");
					if(each){
						elementBinding.each = function(item){
							try{
								var itemElement = each(element, item);
								itemElement.item = item;
								return itemElement;
							}catch(e){
								// TODO: use put-selector?
								console.error(e);
								element.appendChild(document.createElement('span')).appendChild(document.createTextNode(e));
							}
						}
					}*/
				});
			},
			addProperty: function(name, property){
				var properties = (this.properties || (this.properties = []));
				properties.push(name);
				properties[name] = property;
			},
			cssText: ""
		};
		function Call(value){
			this.caller = value;
			this.args = [];
		}
		var CallPrototype = Call.prototype = new Rule;
		CallPrototype.addAttribute = function(name, value){
			this.args.push(value);
		};
		CallPrototype.toString = function(){
			return '(' + this.args + ')'; 
		};
		
		var target, root = new Rule;
		root.root = true;
		root.css = textToParse;
		root.parse = parseSheet;
		
		function onProperty(name, value) {
			//TODO: delete the property if it one that the browser actually uses
			// this is called for each CSS property
			if(name){
				var propertyName = name;
				do{
					var handlerForName = handlers.property[name];
					if(handlerForName){
						return handler(handlerForName, "onProperty", propertyName, value);
					}
					name = name.substring(0, name.lastIndexOf("-"));
				}while(name);
			}
		}
		function onCall(identifier, value){
			var handlerForName = handlers['function'][identifier];
			if(handlerForName){
				handler(handlerForName, "onCall", identifier, value, value.args);
			}
		}
		function onRule(selector, rule){
			rule.onRule();
			var handlerForName = handlers.selector[selector];
			if(handlerForName){
				handler(handlerForName, "onRule", rule);
			}
		}
		function onPseudo(pseudo, rule){
			var handlerForName = handlers.pseudo[pseudo];
			if(handlerForName){
				handler(handlerForName, "onPseudo", pseudo, rule);
			}
		}
		
		function handler(module, type, name, value){
			if(module){
				var rule = target;
				var ruleHandled = function(text){
					if(text){
						/* TODO: is the a way to determine the index deterministically?
						var cssRules = styleSheet.rules || styleSheet.cssRules;
						for(var index = rule.index || 0; index < cssRules.length; index++){
							if(cssRules[index].selectorText == rule.fullSelector(){
								break;
							}
						}*/
						/* TODO: merge IE filters
						if(isIE){
							var filters = [];
							convertedText = convertedText.replace(/filter: ([^;]+);/g, function(t, filter){
								filters.push(filter);
								return "";
							});
							if(filters.length){
								console.log("filters", filters);
								convertedText = "zoom: 1;filter: " + filters.join("") + ";" + convertedText;
							}
						}
						*/
						styleSheet.addRule(rule.fullSelector(), text);
					}
					finishedLoad();
				};
				
				waiting++;
				var onLoad = function(module){
					try{
						var result = module[type](name, value, rule, styleSheet);
						if(result && result.then){
								// a promise, return immediately defer handling
							result.then(ruleHandled, handleError);
						}else{
							ruleHandled(result);
						}
					}catch(e){
						handleError(e);
					}
					function handleError(error){
						// Add some error handling to give developers a better idea of where error occurs.
						// TODO: Add line number, and file name
						console.error('Error occurred processing ' + type.slice(2) + ' ' + name + ' in rule "' + rule.selector + '" {' + rule.cssText);
						if(error){
							console.error(error);
						}
					}
				}
				typeof module == "string" ? require([module], onLoad) : onLoad(module);					
			}
		}
		var stack = [root];
		function parseSheet(textToParse, styleSheet){
			// parse the CSS, finding each rule
			function addInSequence(operand){
				if(sequence){
					// we had a string so we are accumulated sequences now
					sequence.push ? operand && sequence.push(operand) : typeof sequence == 'string' && typeof operand == 'string' ? sequence += operand : sequence = arrayWithoutCommas([sequence, operand]);				
				}else{
					sequence = operand;
				}
			}
			target = root;
			cssScan.lastIndex = 0; // start at zero
			var ruleIndex = 0;
			while(true){
				// TODO: use a simplified regex when we are in a property value 
				var match = cssScan.exec(textToParse);
				var operator = match[4],
					first = match[1].trim(),
					assignment = match[2],
					value = match[3],
					assignmentOperator, name, sequence, assignNextName;
					value = value && value.trim();
				if(assignNextName){
					// first part of a property
					if(assignment){
						name = first;
						assignmentOperator = assignment.charAt(0);
					}else{
						value = first;
					}
					sequence = value;
					if(name || operator != '/'){
						// as long we haven't hit an initial comment, we have the assigned property name now, and don't need to assign again
						assignNextName = false;
					}
				}else{
					// subsequent part of a property
					value = value ? first + assignment : first;
					addInSequence(value);	
				}
				switch(operator){
					case "'": case '"':
						var quoteScan = operator == "'" ? singleQuoteScan : doubleQuoteScan;
						quoteScan.lastIndex = cssScan.lastIndex;
						var parsed = quoteScan.exec(textToParse);
						if(!parsed){
							error("unterminated string");
						}
						var str = parsed[1];
						cssScan.lastIndex = quoteScan.lastIndex;
						// push the string on the current value and keep parsing
						addInSequence(new LiteralString(str));
						continue;
					case '/':
						// we parse these in case it is a comment
						if(textToParse[cssScan.lastIndex] == '*'){
							// it's a comment, scan to the end of the comment
							commentScan.lastIndex = cssScan.lastIndex + 1;
							commentScan.exec(textToParse);
							cssScan.lastIndex = commentScan.lastIndex; 
						}else{
							// not a comment, keep the operator in the accumulating string
							addInSequence('/');
						}
						continue;
					case '\\':
						// escaping sequence
						var lastIndex = quoteScan.lastIndex++;
						addInSequence(textToParse.charAt(lastIndex));
						continue;
					case '(': case '{':
						var newTarget;
						if(operator == '{'){
							assignNextName = true;					
							addInSequence(newTarget = target.newRule(value));
							if(target.root){
								newTarget.cssRule = styleSheet.cssRules[ruleIndex++];
							}
							// todo: check the type
							if(assignmentOperator){
								sequence.creating = true;
							}
						}else{
							addInSequence(newTarget = target.newCall(value));
						}
						newTarget.parent = target;
						if(sequence.creating){
							newTarget.selector = '.x-generated-' + nextId++;
						}else{
							newTarget.selector = target.root ? value : target.selector + ' ' + value;
						}
						target.currentName = name;
						target.currentSequence = sequence;
						target.assignmentOperator = assignmentOperator;
						stack.push(target = newTarget);
						target.operator = operator;
						target.start = cssScan.lastIndex,
						target.selector && target.selector.replace(/:([-\w]+)/, function(t, pseudo){
							onPseudo(pseudo, target);
						});
						name = null;
						sequence = null;
						continue;
				}
				if(sequence){
					var first = sequence[0];
					if(first.charAt && first.charAt(0) == "@"){
						// directive
						if(sequence[0].slice(1,7) == "import"){
							var importedSheet = styleSheet.cssRules[ruleIndex++].styleSheet;
							waiting++;
							// preserve the current index, as we are using a single regex to be shared by all parsing executions
							var currentIndex = cssScan.lastIndex;
							parseSheet(importedSheet.localSource, importedSheet);
							cssScan.lastIndex = currentIndex;
						}
					}else{
						target[assignmentOperator == ':' ? 'addProperty' : 'addAttribute'](name, sequence);
					}
				}
				name = null;
	//			}
				switch(operator){
					case '}': case ')':
						var ruleText = textToParse.slice(target.start, cssScan.lastIndex - 1);
						target.cssText = ruleText;
						if(operator == '}'){
							onRule(target.selector, target);
							if(target.selector.slice(0,2) != "x-"){
								target.eachProperty(onProperty);
							}
						}else{
							onCall(target.caller, target);
						}
						stack.pop();
						target = stack[stack.length - 1];				
						sequence = target.currentSequence;
						name = target.currentName;
						assignmentOperator = target.assignmentOperator;
						break;
					case "":
						// no operator means we have reached the end
						callback && callback();
						return;
					case ';':
						sequence = null;
						assignNextName = true;
				}
			}
		}
		parseSheet(textToParse,styleSheet);
		function finishedLoad(){
			if(--waiting == 0){
				if(callback){
					callback(styleSheet);
				}
			}
		}		
		finishedLoad(target);
	}
	search('link');
	search('style');


	var rulesListeningToAttribute = {};

	function findAttributeInAncestors(element, name, listeningRule){	
		var elementAncestor = element;
		if(listeningRule){
			var rules = (rulesListeningToAttribute[name] || (rulesListeningToAttribute[name] = []));
			rules.push(listeningRule); 
		}
		do{
			var value = elementAncestor[name];
			// if we have a callback, setup a listener
			if(listeningRule){
				var oldDescriptor = Object.getOwnPropertyDescriptor(elementAncestor, name);
				var descriptor, setter = oldDescriptor && oldDescriptor.set;
				if(!setter){ // only if the a setter hasn't already been defined
					if(!descriptor){ // create the descriptor just once, and reuse
						// determine if we should call setAttribute
						var useSetAttribute = typeof value == 'string';						descriptor = {
							get: function(){
								return this._values && this._values[name];
							},
							set: function(value){
								(this._values || (this._values = {}))[name] = value;
								// set the attribute, the default action
								useSetAttribute && this.setAttribute(name, value);
								for(var i = 0; i < rules.length; i++){
									var rule = rules[i];
									var nodeList = this.querySelectorAll(rule.selector);
									for(var j = 0; j < nodeList.length; j++){
										rule.recomputeAttribute(nodeList[j], name);
									}
								}
							}
						}
					}
					value && ((elementAncestor._values || (elementAncestor._values = {}))[name] = value);
					Object.defineProperty(elementAncestor, name, descriptor);
				}
			}
			
		}while(!value && (elementAncestor != globalAttributes) && 
				(elementAncestor = elementAncestor.parentNode || globalAttributes));
		return value;
	}
	
	// elemental section
	var testDiv = document.createElement("div");
	var features = {
		"dom-qsa2.1": !!testDiv.querySelectorAll
	};
	function has(feature){
		return features[feature];
	}
	var matchesSelector = testDiv.matchesSelector || testDiv.webkitMatchesSelector || testDiv.mozMatchesSelector || testDiv.msMatchesSelector || testDiv.oMatchesSelector;
	var selectorRenderers = [];
	var classHash = {}, propertyHash = {};
	var renderQueue = [];
	var documentQueried;
	require(["dojo/domReady!"], function(){
		documentQueried = true;
		if(has("dom-qsa2.1")){
			for(var i = 0, l = selectorRenderers.length; i < l; i++){
				findMatches(selectorRenderers[i]);
			}
			renderWaiting();
		}else{
			var all = document.all;
			for(var i = 0, l = all.length; i < l; i++){
				update(all[i]);
			}
		}
	});//else rely on css expressions (or maybe we should use document.all and just scan everything)
	function findMatches(renderer){
		// find the elements for a given selector and apply the renderers to it
		var toRender = [];
		var results = document.querySelectorAll(renderer.selector);
		var name = renderer.name;
		for(var i = 0, l = results.length; i < l; i++){
			var element = results[i];
			var currentStyle = element.elementalStyle;
			var currentSpecificities = element.elementalSpecificities;
			if(!currentStyle){
				currentStyle = element.elementalStyle = {};
				currentSpecificities = element.elementalSpecificities = {};
			}
			// TODO: only override if the selector is equal or higher specificity
			// var specificity = renderer.selector.match(/ /).length;
			if(true || currentSpecificities[name] <= renderer.specificity){ // only process changes
				var elementRenderings = element.renderings;
				if(!elementRenderings){
					elementRenderings = element.renderings = [];
					renderQueue.push(element);
				}
				
				elementRenderings.push({
					name: name,
					rendered: currentStyle[name] == renderer.propertyValue,
					renderer: renderer
				});
				currentStyle[name] = renderer.propertyValue;
			} 
		}
		
	}
	var isCurrent;
	function renderWaiting(){
		// render all the elements in the queue to be rendered
		for(var i = 0; i < renderQueue.length; i++){
			var element = renderQueue[i];
			var renderings = element.renderings, currentStyle = element.elementalStyle;
			delete element.renderings;
			for(var j = 0; j < renderings.length; j++){
				var rendering = renderings[j];
				var renderer = rendering.renderer;
				var rendered = renderer.rendered;
				isCurrent = currentStyle[rendering.name] == renderer.propertyValue; // determine if this renderer matches the current computed style
				if(!rendered && isCurrent){
					try{
						renderer.render(element);
					}catch(e){
						console.error(e, e.stack);
						put(element, "div.error", e.toString());
					}
				}
				if(rendered && !isCurrent && renderer.unrender){
					renderer.unrender(element);
					renderings.splice(j--, 1); // TODO: need to remove duplicate rendered items as well
				}
			}
		}
		renderQueue = [];
	}
	function apply(element, renderers){
		// an element was found that matches a selector, so we apply the renderers
		for(var i = 0, l = renderers.length; i < l; i++){
			renderers[i](element);
		}
	}
	//window.put = window.put ? put : {};
	put.onaddclass = function(element, className){
		var selectorRenderers = classTriggers[className];
		var renderers = selectorRenderers[selector];
		for(var i = 0, l = selectorRenderers.length; i < l; i++){
			var renderer = selectorRenderers[i];
			if(matchesSelector.apply(element, renderer.selector)){
				renderer.render(element);
				(element.renderers = element.renderers || []).push(renderer);
			}
		}
	};
	put.onremoveclass = function(element){
		var elementRenderers = element.renderers;
		if(elementRenderers){
			for(var i = elementRenderers.length - 1; i >= 0; i--){
				var renderer = elementRenderers[i];
				if(!matchesSelector.apply(element, renderer.selector)){
					renderer.unrender(element);
					elementRenderers.splice(i, 1);
				}
			}
		}
	};
	put.oncreateelement = function(element){
		tagTriggers[element.tagName]
	}
	function update(element){
	/* At some point, might want to use getMatchedCSSRules for faster access to matching rules 			
	 	if(typeof getMatchedCSSRules != "undefined"){
			// webkit gives us fast access to which rules apply
			getMatchedCSSRules(element);
		}else{*/
			for(var i = 0, l = selectorRenderers.length; i < l; i++){
			var renderer = selectorRenderers[i];
			if(matchesSelector ?
					// use matchesSelector if available
					matchesSelector.call(element, renderer.selector) : // TODO: determine if it is higher specificity that other  same name properties
					// else use IE's custom css property inheritance mechanism
					element.currentStyle[renderer.name] == renderer.propertyValue){
				renderer.render(element);
			}
		}
		
	}


	function generate(value, rule){
		return function(element, item){
			var lastElement = element;
			for(var i = 0, l = value.length;i < l; i++){
				var part = value[i];
				if(part.eachProperty){
					put(lastElement, part.selector);
					xstyle.update(lastElement);
				}else if(typeof part == 'string'){
					if(part.charAt(0) == '='){
						part = part.slice(1); // remove the '=' at the beginning					
					}
					var children = part.split(',');
					for(var j = 0, cl = children.length;j < cl; j++){
						var child = children[j].trim();
						if(child){
							lastElement = put(j == 0 ? lastElement : element, child);
							xstyle.update(lastElement);
						}
					}
				}else{
					lastElement.appendChild(document.createTextNode(part.value));
				}
			}
			return lastElement;
		}
	}
	
	var xstyle =  {
		process: checkImports,
		vendorPrefix: vendorPrefix,
		onProperty: function(name, value){
			// basically a noop for most operations, we rely on the vendor prefixing in the main property parser 
			if(name == "opacity" && vendorPrefix == "-ms-"){
				return 'filter: alpha(opacity=' + (value * 100) + '); zoom: 1;';
			}
			return vendorPrefix + name + ':' + value + ';';
		},
		onCall: function(name, rule){
			// handle extends(selector)
			var args = rule.args;
			var extendingRule = rule.parent;
			var parentRule = extendingRule;
			do{
				var baseRule = parentRule.rules && parentRule.rules[args[0]];
				parentRule = parentRule.parent;
			}while(!baseRule);
			var newText = baseRule.cssText;
			extendingRule.cssText += newText;
			extendingRule.properties = Object.create(baseRule.properties);
			baseRule.eachProperty(function(name, value){
				if(name){
					var ruleStyle = extendingRule.cssRule.style;
					if(!ruleStyle[name]){
						ruleStyle[name] = value;
					}
				}
			});
		},
		parse: parse,
		
		addRenderer: function(propertyName, propertyValue, rule, handler){
			var renderer = {
				selector: rule.selector,
				propertyValue: propertyValue,
				name: propertyName,
				render: handler
			};
			// the main entry point for adding elemental handlers for a selector. The handler
			// will be called for each element that is created that matches a given selector
			selectorRenderers.push(renderer);
			if(documentQueried){
				findMatches(renderer);
			}
			renderWaiting();
			/*if(!matchesSelector){
				// create a custom property to identify this rule in created elements
				return (renderers.triggerProperty = 'selector_' + encodeURIComponent(selector).replace(/%/g, '/')) + ': 1;' +
					(document.querySelectorAll ? '' : 
						// we use css expressions for IE6-7 to find new elements that match the selector, since qSA is not available, wonder if it is better to just use document.all...
						 'zoom: expression(cssxRegister(this,"' + selector +'"));');
			}*/
		},
		update: update, // this should be called for newly created dynamic elements to ensure the proper rules are applied
		clearRenderers: function(){
			// clears all the renderers in use
			selectorRenderers = [];
		},
		globalAttributes: globalAttributes
	};
	return xstyle;

});
