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
						with(scope){
							var __module = eval(value);
							var prototype = __module.prototype;
							var props = {layout: rule.layout};
							if(prototype){
								rule.eachProperty(function(t, name, value){
									if(name in prototype){
										var type = typeof prototype[name];
										if(type == "string"){
											props[name] = value;
										}else if(type == "number"){
											props[name] = +value;
										}else{
											props[name] = eval(value);
										}
									}
								});
							}
							__module(props, domNode);
						}
					});
				};
			},
			role: "layout"
		};
	}
	var def = new Widget({});
	Widget.widget = def.widget;
	Widget.role = def.role;
	return Widget; 
})