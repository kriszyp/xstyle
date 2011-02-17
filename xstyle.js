/* Extensible CSS Loader */
define(["./css", "sizzle"], function(cssLoader, querySelectorAll){
	cssLoader.createHandle = function(){
			return {
				extend: function(){
					var css = this.cssText;
					var propertyExtensions;
					// process each extension argument
					for(var i = 0; i < arguments.length; i++){
						var arg = arguments[i];
						// special property for preprocessing CSS
						if(arg.processCss == "function"){
							css = arg.processCss(css);
						}else{
							// add each set of property extensions
							if(propertyExtensions){
								for(var i in arg){
									propertyExtensions[i] = arg[i];
								}
							}else{ // no need to copy for first one, just use it
								propertyExtensions = arg;
							}
						}
					}
					var fullProperties;
					var lastRule = this;
					this.renderingRules = {};
					var onProperty = function(t, name, value){
						// this is called for each CSS property
						var propertyHandler = propertyExtensions[name];
						if(typeof propertyHandler == "function"){
							// we have a CSS property handler for this property
							var result = propertyHandler(value, lastRule);
							if(typeof result == "function"){
								// if it returns a function, it is a renderer function
								if(!lastRule.renderers){
									lastRule.renderers = [];
									this.renderingRules[lastRule.selector] = lastRule.renderers;
								}
								lastRule.renderers.push(renderer);
							}
							else if(typeof result == "string"){
								// otherwise it replacement CSS
								return result;
							}
						}
						return "";
					};
					// parse the CSS, finding each rule
					css = css.replace(/\s*([^{;]+{)?\s*([^{}]+;)?\s*(})?/g, function(full, selector, properties, close){
						// called for each rule
						if(selector){
							// a selector as found, start a new rule (note this can be nested inside another selector)
							lastRule = new Rule({parent: lastRule});						
							fullProperties = "";
						}
						if(properties){
							// some properties were found
							fullProperties += properties;
						}
						if(close){
							// rule was closed with }
							var selector = lastRule.layout ? onProperty(0, "layout", lastRule.layout) || lastRule.selector : lastRule.selector; // run layout property  
							return selector + "{" + 
								fullProperties.replace(/([^:]+):([^;]+);?/g, onProperty) + "}"; // process all the css properties
						}
						return "";
					});
					lastRule = this;
					// might only need to do this if we have rendering rules
					require.ready(function(){
						for(var i in lastRule.renderingRules){
							lastRule.renderInto(i);
						}
					});
					if(this.cssText != css){
						// it was modified, add the modified one
						cssLoader.insertCss(css);
					}
				},
				renderInto: function(selector, node){
					if(typeof selector == "string"){
						// render the given selector
						var renderers = this.renderingRules[selector];
						var targets = querySelectorAll(i, node);
					}else{
						// render the root of the css
						targets = [node];
						var renders = this.renderers;
					}
					var renderersLength = renderers.length;
					for(var i = 0; i < targets.length; i++){
						// iterate through the target elements and render each oen
						var target = targets[i];
						for(var j = 0; j < renderersLength; j++){
							renderers[j]({}, target);
						}
					}
					
				}
			};
		};		
	return cssLoader;
});