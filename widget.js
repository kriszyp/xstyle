define([], function(){
	function Widget(scope){
		return {
			widget: function(value, rule){
				var modules = [];
				value.replace(/require\s*\(\s*['"]([^'"]*)['"]\s*\)/g, function(t, moduleId){
					modules.push(moduleId);
				});
				require(modules);
				return function(domNode){
					require(modules, function(){
						var __module;
						with(scope){
							__module = eval(value);
						}
						__module({}, domNode);
					});
				};
			}
		};
	}
	Widget.widget = new Widget({}).widget;
	return Widget; 
})