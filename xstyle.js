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
		require = function(){
			
		}
	})();
}
define("xstyle/xstyle", ["require"], function (require) {
	"use strict";
	var undef;
	function search(tag){
		var elements = document.getElementsByTagName(tag);
		for(var i = 0; i < elements.length; i++){
			checkImports(elements[i]);
		}
	}
	function checkImports(element, callback, fixedImports){
		var sheet = element.sheet || element.styleSheet;
		var needsParsing, cssRules = sheet.rules || sheet.cssRules;
		function fixImports(){
			// need to fix imports, applying load-once semantics for all browsers, and flattening for IE to fix nested @import bugs
			require(["./load-imports"], function(load){
				load(element, function(){
					checkImports(element, callback, true);
				});
			});
		}
		if(!fixedImports && sheet.imports && sheet.imports.length){
			// this is how we check for imports in IE
			return fixImports();
		}
		for(var i = 0; i < cssRules.length; i++){								
			var rule = importRules[i];
			if(rule.href && !fixedImports){
				// it's an import (for non-IE browsers)
				return fixImports();
			}
			if(rule.selectorText.substring(0,2) == "x-"){
				// an extension is used, needs to be parsed
				needsParsing = true;
			}
		}
		if(needsParsing){
			parse(sheet.source || sheet.ownerElement.innerHTML, sheet, callback);
		}
	}
	function parse(css, styleSheet, callback) {
		// normalize the stylesheet.
		if(!styleSheet.addRule){
			// only FF doesn't have this
			styleSheet.addRule = function(selector, style, index){
				return this.insertRule(selector + "{" + style + "}", index >= 0 ? index : this.cssRules.length);
			}
		}
		if(!styleSheet.deleteRule){
			styleSheet.deleteRule = sheet.removeRule;
		}
		var handlers = {property:{}}, handlerModules = {};
		function addHandler(type, name, module){
			var handlersForType = handlers[type] || (handlers[type] = {});
			var handlersForName = handlersForType[name] || (handlersForType[name] = []);  
			handlersForName.push(module);
		}
		function addExtensionHandler(type){
			addHandler("selector", 'x-' + type, {
				onRule: function(rule){
					rule.eachProperty(function(name, value){
						var ifUnsupported = value.charAt(value.length - 1) == "?";
						value = value.replace(/module\s*\(|\)\??/g, '');
						addHandler(type, name, value);
					});
				}
			});
		}
		addExtensionHandler("property");
		addExtensionHandler("value");
		addExtensionHandler("pseudo");
		var waiting = 1;
		var baseUrl = styleSheet.href.replace(/[^\/]+$/,'');
		var properties = [], values = [];
		var valueModules = {};
		
		var convertedRules = [];
		var valueRegex = new RegExp("(?:^|\\W)(" + values.join("|") + ")(?:$|\\W)");
		function Rule () {}
		Rule.prototype = {
			eachProperty: function (onproperty, propertyRegex) {
				var selector, css;
				selector = this.selector; //(this.children ? onproperty(0, "layout", this.children) || this.selector : this.selector);
				this.cssText.replace(/\s*([^;:]+)\s*:\s*([^;]+)?/g, function (full, name, value) {
					onproperty(name, value);
				});
				if(this.children){
					for(var i = 0; i < this.children.length; i++){
						var child = this.children[i];
						if(!child.selector){ // it won't have a selector if it is property with nested properties
							onproperty(child.property, child);
						}
					}
				}
			},
			fullSelector: function(){
				return (this.parent ? this.parent.fullSelector() : "") + (this.selector || "") + " ";  
			},
			cssText: ""
		};
		
		var lastRule = new Rule;
		lastRule.css = css;
		
		function onProperty(name, value) {
			// this is called for each CSS property
			var handlersForName = handlers.property[name];
			if(handlersForName){
				for(var i = 0; i < handlersForName.length; i++){
					handler(handlersForName[i], "onProperty", name, value);
				}
			}
		}
		function onIdentifier(identifier, name, value){
			var handlersForName = handlers.value[identifier];
			for(var i = 0; i < handlersForName.length; i++){
				handler(handlersForName[i], "onIdentifier", name, value);
			}
		}
		function onRule(selector, rule){
			var handlersForName = handlers.selector[selector];
			if(handlersForName){
				for(var i = 0; i < handlersForName.length; i++){
					handler(handlersForName[i], "onRule", rule);
				}
			}
		}
		function handler(module, type, name, value){
			if(module){
				var rule = lastRule;
				var ruleHandled = function(text){
					console.log("loaded ", module, text);
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
				console.log("loading ", module, name, value);
				var onLoad = function(module){
					var result = module[type](name, value, rule, styleSheet);
					if(result && result.then){
							// a promise, return immediately defer handling
						result.then(ruleHandled);
					}else{
						ruleHandled(result);
					}
				}
				typeof module == "string" ? require([module], onLoad) : onLoad(module);					
			}
		}
		// parse the CSS, finding each rule
		css.replace(/\s*(?:([^{;\s]+)\s*{)?\s*([^{}]+;)?\s*(};?)?/g, function (full, selector, properties, close) {
			// called for each rule
			if (selector) {
				// a selector was found, start a new rule (note this can be nested inside another selector)
				var newRule = new Rule();
				(lastRule.children || (lastRule.children = [])).push(newRule); // add to the parent layout 
				newRule.parent = lastRule;
				if(selector.charAt(selector.length - 1) == ":"){
					// it is property style nesting
					newRule.property= selector.substring(0, selector.length - 1);
				}else{
					// just this segment of selector
					newRule.selector = selector; 
				}
				lastRule = newRule;
			}
			if (properties) {
				// some properties were found
				lastRule.cssText += properties;
			}
			if (close) {
				// rule was closed with }
				// TODO: use a specialized regex that only looks for registered properties
				lastRule.cssText.replace(/\s*([^;:]+)\s*:\s*([^;]+)?/g, function (full, name, value) {
					onProperty(name, value);
					value.replace(valueRegex, function(t, identifier){
						//onIdentifier(identifier, name, value);
					});
				});
				if(lastRule.children){
					for(var i = 0; i < lastRule.children.length; i++){
						var child = lastRule.children[i];
						if(!child.selector){ // it won't have a selector if it is property with nested properties
							onProperty(child.property, child);
						}
					}
				}
				onRule(lastRule.selector, lastRule);
				lastRule = lastRule.parent;
			}
		});
		function finishedLoad(){
			if(--waiting == 0){
				if(callback){
					callback(styleSheet);
				}
			}
		}		
		finishedLoad();
	}
	search('link');
	search('style');
	return {
		process: checkImports
	};

});
