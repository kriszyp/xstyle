define(["./css", "has", "compose"], function(css, has, Compose){
	function vendorize(selector, value, property){
		this.addCssText(selector + "{-webkit-" + property + ":" + value + ";-moz-" + property + ":" + value + ";}");
	}
	var regexCache = {};
	return Compose.create(css, {
		needsProcessing: !has("css3"),
		processCss: function(css, baseUrl, loaded){
			var additionalCss;
			var self = this;
			var waitingOn = 1;
			css = css.replace(/(@media\s+|@import\s+[^\s]+\s+)(.+);/g, function(t, rule, query){
				if(self.querySatisfied(query)){
					return rule + parts.join(" and ") + ';';
				}
				return '';
			});
			function dependencyLoaded(){
				waitingOn--;
				if(waitingOn == 0){
					loaded();
				}
			}
			function loadingDependency(load){
				waitingOn++;
				load(dependencyLoaded);
			}
			var properties = this.properties;
			// iterate through the property handlers
			for(var property in properties){
				var func = properties[property];
				// cache the regular expressions for speed
				var regex = regexCache[property];
				if(!regex){
					regex = regexCache[property] = new RegExp("([^};]+){[^}]*" + property + ":\\s*([^;}]+)", "gi"); 
				}
				css.replace(regex, function(t, selector, value){
					func.call(self, selector, value, property, loadingDependency);
				});
			}
			/*return loaded(css.replace(/url\(['"]?([^\)'"]+)["']?\)/g, function(t, url){
				if(url.charAt(0) != "/"){
					url = baseUrl + url; 
				}
				return "url(" + url + ")";
			}));*/ 
			dependencyLoaded();
		},
		properties: {
			"border-radius": vendorize
		},
		addCssText: function(){
			
		},
		querySatisfied: function(query){
			var parts = query.split(" and ");
			for(var part, i = 0; part = parts[i]; i++){
				var undefined, featureValue = part.match(/\((not )?([\w-]+)(:\s*([^\)]+))?\)/);
				if(featureValue){
					var not = featureValue[1];
					var feature = featureValue[2];
					var prefix = feature.substring(0, feature.indexOf("-"));
					if(prefix == "native"){
						
					}
					var result = (prefix == "min" || prefix == "max") ? has("css-" + feature.substring(4)) :
									prefix == "agent" ? new RegExp(feature.substring(6), "i").test(navigator.userAgent) : 
									has(prefix == "has" ? feature.substring(4) : ("css-" + feature));
					if(prefix == "min"){
						result = result <= featureValue[4];
				}
				if(prefix == "max"){
						result = result >= featureValue[4];
					}
					if(!result != !not){
						parts.splice(i--, 1);
					}else{
						return ""; // didn't match, escape
					}
				}
			}
			
		}
		
	});
});