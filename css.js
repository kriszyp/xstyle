define(["has"], function(has){
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
			var url = parentRequire.toUrl(id + ".css");
			if(definedCss[url]){
				// it was defined in the build layer, so we don't need to make any request 
				// for the CSS, but we need inline it
				processCss(definedCss[url], url.replace(/[^\/]+$/,''));
				insertCss(definedCss[url]);
			}
			if(has("event-link-onload") && !this.needsProcessing){
				insertLink(url).onload = function(){
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
							self.processCss(xhr.responseText, url.replace(/[^\/]+$/,''), function(){
								loaded();
							});
						}else{
							throw new Error("Unable to load css " + url);
						}
					}
				};
				xhr.send();
			}			
		},
		needsProcessing: false,
		processCss: function (css, baseUrl, loaded){
			var additionalCss;
			css = css.replace(/(@import\s+[^\s]+\s+)(.+);/g, function(t, rule, query){
				// TODO: import
				return rule + parts.join(" and ") + ';';
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