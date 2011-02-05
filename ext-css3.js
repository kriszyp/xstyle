define(["./css3", "compose", "sizzle"], function(css, Compose, querySelectorAll){
	return Compose.create(css, {
		needsProcessing: true,
		properties: Compose.create(css.properties, {
			appearance: function(selector, value, property, loadingDependency){
				var appearances = value.split(/,\s*/);
				for(var i = 0; i < appearances.length; i++){
					var appearance = appearances[i];
					
					var moduleMatch = appearance.match(/module\(['"]?([^\)'"]+)["']?\)/);
					if(moduleMatch){
						loadingDependency(function(depedencyLoaded){
							require([moduleMatch[1]], function(module){
								depedencyLoaded();
								require.ready(function(){
									var results = querySelectorAll(selector);
									for(var i = 0; i < results.length; i++){
										module({}, results[i]);
									}
								});
							});
						});
						break;
					}
					var input = document.createElement("input");
					input.setAttribute("type", appearance);
					if(input.type == appearance){
						break;
					}
				}
			}
		}),
/*		processCss: Compose.after(function(css, baseUrl, loaded){
			var additionalCss;
			var self = this;
			css.replace(/([^\};]+){[^\}]*@module\s+([^\s]+)\s*(.+)?;/g, function(t, rule, module, query){
				if(!query || self.querySatisfied(query)){
					require([module], function(module){
						require.ready(function(){
							var results = querySelectorAll(rule);
							for(var i = 0; i < results.length; i++){
								module({}, results[i]);
							}
							loaded(module);
						});
					});
				}
			});
		})*/
		
	});
});