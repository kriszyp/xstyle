/* Extensible CSS Loader */
(function(define){
define(["has", "sizzle"], function(has, querySelectorAll){
	if(typeof definedCss == "undefined"){
		definedCss = {};
	}
	has.add("event-link-onload", false); /*document.createElement("link").onload === null);*/
	has.add("dom-create-style-element", !document.createStyleSheet);
	function insertLink(href){
		if(has("dom-create-style-element")){
			// we can use standard <link> element creation
			styleSheet = document.createElement("link");
			styleSheet.setAttribute("type", "text/css");
			styleSheet.setAttribute("rel", "stylesheet");
			styleSheet.setAttribute("href", href);
			document.getElementsByTagName("head")[0].appendChild(styleSheet);
		}
		return styleSheet;
	}
	
	function insertCss(css){
		if(has("dom-create-style-element")){
			// we can use standard <style> element creation
			styleSheet = document.createElement("style");
			styleSheet.setAttribute("type", "text/css");
			styleSheet.appendChild(document.createTextNode(css));
			document.getElementsByTagName("head")[0].appendChild(styleSheet);
		}
		else{
			try{
				var styleSheet = document.ceateStyleSheet();
			}catch(e){
				// if we went past the 31 stylesheet limit in IE, we will combine all existing stylesheets into one. 
				var styleSheets = dojox.html.getStyleSheets(); // we would only need the IE branch in this method if it was inlined for other uses
				var cssText = "";
				for(var i in styleSheets){
					var styleSheet = styleSheets[i];
					if(styleSheet.href){
						aggregate =+ "@import(" + styleSheet.href + ");";
					}else{
						aggregate =+ styleSheet.cssText;
					}
					dojo.destroy(styleSheets.owningElement);
				}
				var aggregate = dojox.html.getDynamicStyleSheet("_aggregate");
				aggregate.cssText = cssText;
				return dojox.html.getDynamicStyleSheet(styleSheetName); 
			}
			styleSheet.cssText = css;
		}
		return css;
	}
	function load(url, loaded){
	}
	return {
		load: function(id, parentRequire, loaded, config){
			console.log("css loading " + id);
			if(id.indexOf(".") == -1){
				id = id + ".css";
			}
			var url = parentRequire ? parentRequire.toUrl(id) : id;
			if(definedCss[url]){
				// it was defined in the build layer, so we don't need to make any request 
				// for the CSS, but we need inline it
				processCss(definedCss[url], url.replace(/[^\/]+$/,''));
				insertCss(definedCss[url]);
			}
			var cssHandle;
			var callbacks = [];
			var promise = {
				then: function(callback){
					if(cssHandle){
						callback(cssHandle);
					}else{
						callbacks.push(callback);
					}
				}
			};
			if(!loaded){
				loaded = function(handle){
					for(var i = 0;i < callbacks.length; i++){
						callbacks[i](handle);
					}
				};
			}
			if(has("event-link-onload")){
				insertLink(url).onload = function(){
					cssHandle = this.createHandle();
					loaded(cssHandle);
					console.log(url + "loaded");
				};
			}else{
				// need to request the CSS
				var xhr = typeof XMLHttpRequest == "undefined" ?
					new ActiveXObject("Microsoft.XMLHTTP") :
					new XMLHttpRequest;
				insertLink(url);
				xhr.open("GET", url, true);
				var self = this;
				xhr.onreadystatechange = function(){
					if(xhr.readyState == 4){
						if(xhr.status < 400){
							self.processCss(xhr.responseText, url.replace(/[^\/]+$/,''), function(cssText){
								cssHandle = this.createHandle();
								cssHandle.cssText = cssText;
								loaded(cssHandle);
							});
						}else{
							throw new Error("Unable to load css " + url);
						}
					}
				};
				xhr.send();
			}
			return promise;		
		},
		createHandle: function(){
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
							lastRule.render(i);
						}
					});
					if(this.cssText != css){
						// it was modified, add the modified one
						cssLoader.insertCss(css);
					}
				},
				render: function(selector, node){
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
		},
		setQueryEngine: function(engine){
			querySelectorAll = engine;
		},
		processCss: function (css, baseUrl, loaded){
			css = css.replace(/\/\*[\s\S]*?\*\//g,'') // remove comments
						.replace(/(@import\s+[^\s]+\s+)(.+);/g, function(t, rule, query){
				// TODO: import
				return t; //return rule + parts.join(" and ") + ';';
			});
			loaded(css.replace(/url\("?([^\)"]+)"?\)/g, function(t, url){
				if(url.charAt(0) != "/"){
					url = baseUrl + url; 
				}
				return "url(" + url + ")";
			})); 
		}
		
	};
})
})(typeof define!="undefined"?define:function(factory){
	xStyle = factory(has); // create a global if standalone
});