var fs = require('fs'),
	pathModule = require('path'),
	xstyle,
	requiredModules = [];

define = function(id, deps, factory){
	function pseudoRequire(deps){
		[].push.apply(requiredModules, deps);
	}
	pseudoRequire.isBuild = true;
	xstyle = factory(pseudoRequire);
};

document = {
	createElement: function(){
		return {};
	},
	getElementsByTagName: function(){
		return [];
	},
	addEventListener: function(){}
};
navigator = {
	userAgent: "build"
};
require('./xstyle');

function main(source, target){
	var imported = {};
	var cssText = fs.readFileSync(source).toString("utf-8");
	var basePath = source.replace(/[^\/]*$/, '');
	function insertRule(cssText){
		browserCss.push(cssText);
	}
	xstyle.parse.getStyleSheet = function(importRule, sequence, styleSheet){
		console.log("path parst", styleSheet.href, sequence[1].value);
		var path = pathModule.resolve(styleSheet.href, sequence[1].value);
		console.log("path", path);
		return {
			localSource: fs.readFileSync(path).toString("utf-8"),
			href: path,
			insertRule: insertRule,
			cssRules: []
		}
	};
	var browserCss = [];
	var xstyleCss = [];
	var rootRule = xstyle.parse(cssText, {href:basePath, cssRules:[], insertRule: insertRule});
	console.log("requiredModules",requiredModules);
	function visit(parent){
		if(!parent.root){
			browserCss.push(parent.selector + '{' + parent.cssText + '}'); 
		}
		for(var i in parent.variables){
			xstyleCss.push(i,'=',parent.variables[i]);
		}
	}
	visit(rootRule);
	console.log('browserCss:', browserCss.join(''));
	console.log('xstyleCss:', xstyleCss.join(''));
	if(target){
		fs.writeFileSync(target, html);
	}else{
		console.log(html);
	}
	
}
if(require.main == module){
	main.apply(this, process.argv.slice(2));
}
