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
			if(!id.match(/\.\w+$/)){
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
			var self = this;
			if(has("event-link-onload")){
				insertLink(url).onload = function(){
					cssHandle = self.createHandle();
					loaded(cssHandle);
				};
			}else{
				// need to request the CSS
				var xhr = typeof XMLHttpRequest == "undefined" ?
					new ActiveXObject("Microsoft.XMLHTTP") :
					new XMLHttpRequest;
				insertLink(url);
				xhr.open("GET", url, true);
				xhr.onreadystatechange = function(){
					if(xhr.readyState == 4){
						if(xhr.status < 400){
							self.processCss(xhr.responseText, url.replace(/[^\/]+$/,''), function(cssText){
								cssHandle = self.createHandle();
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
			function Rule(){}
			Rule.prototype = {
				eachProperty: function(onProperty){
					return this.cssText.replace(/\s*([^;:]+)\s*:\s*([^;]+)?/g, onProperty);
				},
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
								for(var j in arg){
									propertyExtensions[j] = arg[j];
								}
							}else{ // no need to copy for first one, just use it
								propertyExtensions = arg;
							}
						}
					}
					var lastRule = this;
					function onProperty(t, name, value){
						// this is called for each CSS property
						var propertyHandler = propertyExtensions[name];
						if(typeof propertyHandler == "function"){
							// we have a CSS property handler for this property
							var result = propertyHandler(value, lastRule);
							if(typeof result == "function"){
								// if it returns a function, it is a renderer function
								var renderers = (lastRule.renderers || (lastRule.renderers = []));
								renderers[propertyHandler.role || propertyExtensions.role || renderers.length] = result;
							}
							else if(typeof result == "string"){
								// otherwise it replacement CSS
								return result;
							}
						}
						return t;
					};
					// parse the CSS, finding each rule
					css = css.replace(/\s*(?:([^{;]+)\s*{)?\s*([^{}]+;)?\s*(};?)?/g, function(full, selector, properties, close){
						// called for each rule
						if(selector){
							// a selector as found, start a new rule (note this can be nested inside another selector)
							var newRule = new Rule();
							(lastRule.layout || (lastRule.layout = [])).push(newRule); 
							newRule._parent = lastRule;
							newRule.selector = selector;
							lastRule = newRule;
							lastRule.cssText = "";
						}
						if(properties){
							// some properties were found
							lastRule.cssText += properties;
						}
						if(close){
							// rule was closed with }
							var result = (lastRule.layout ? onProperty(0, "layout", lastRule.layout) || lastRule.selector : lastRule.selector) + 
								"{" + lastRule.eachProperty(onProperty) + "}"; // process all the css properties
							lastRule = lastRule._parent;
							return result; 
						}
						return "";
					});
					lastRule = this;
					// might only need to do this if we have rendering rules
					require.ready(function(){
						lastRule.render();
					});
					if(this.cssText != css){
						this.cssText = css;
						// it was modified, add the modified one
						insertCss(css);
					}
				},
				render: function(selector, node){
					if(typeof selector == "string" || selector == undefined){
						var layout = this.layout;
						for(var i = 0; i < layout.length; i++){
							// iterate through the layout and render each matching one
							var rule = layout[i];
							if(rule.selector == selector || selector == undefined){
								var targets = querySelectorAll(rule.selector, node)
								for(var j = 0; j < targets.length; j++){
									rule.render(targets[j]);
								}
							}
						}
						return;
					}
					var renderers = this.renderers;
					if(renderers){
						for(var j in renderers){
							renderers[j](selector/*node*/);
						}
					}
				}
			};
			return new Rule();
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