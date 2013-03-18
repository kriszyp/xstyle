/*
 * This module can be executed standalone in node, to build CSS files, inlining imports, and 
 * pre-processing extensions for faster run-time execution. This module is also
 * used by the AMD build process.
 */

document = {
	createElement: function(){
		return {style:
			{// TODO: may want to import static has features to determine if some of these exist
			}
		};
	},
	getElementsByTagName: function(){
		return [];
	},
	addEventListener: function(){}
};
navigator = {
	userAgent: "build"
};

var pseudoDefine = function(id, deps, factory){
		function pseudoRequire(deps){
			[].push.apply(requiredModules, deps);
		}
		pseudoRequire.isBuild = true;
		xstyle = factory(pseudoRequire);
	};
var requiredModules = [];

if(typeof define == 'undefined'){
	var fs = require('fs'),
		pathModule = require('path'),
		xstyle;
	define = pseudoDefine; 
	require('./xstyle');
}else{
	define(['build/fs'], function(fsModule){
		fs = fsModule;
		pathModule = {
			resolve: function(base, target){
				return base.replace(/[^\/]+$/, '') + target;
			}
		}
		return function(xstyleText){
			var define = pseudoDefine;
			eval(xstyleText);
			return process;
		};
	});
}
function main(source, target){
	var imported = {};
	var basePath = source.replace(/[^\/]*$/, '');
	var cssText = fs.readFileSync(source).toString("utf-8");
	process(cssText, basPath);
	if(target){
		fs.writeFileSync(target, html);
	}else{
		console.log(html);
	}
}
function process(cssText,basePath){
	function insertRule(cssText){
		browserCss.push(cssText);
	}
	xstyle.parse.getStyleSheet = function(importRule, sequence, styleSheet){
		console.log("path parst", styleSheet.href, sequence[1].value);
		var path = pathModule.resolve(styleSheet.href, sequence[1].value);
		var localSource = '';
		try{
			localSource = fs.readFileSync(path).toString("utf-8");
		}catch(e){
			console.error(e);
		}
		return {
			localSource: localSource,
			href: path,
			insertRule: insertRule,
			cssRules: []
		}
	};
	var browserCss = [];
	var xstyleCss = [];
	var rootRule = xstyle.parse(cssText, {href:basePath, cssRules:[], insertRule: insertRule});
	console.log("requiredModules",requiredModules);
	var intrinsicVariables = {
		Math:1,
		require:1,
		item: 1
	}
	function visit(parent){
		if(!parent.root){
			browserCss.push(parent.selector + '{' + parent.cssText + '}'); 
		}
		for(var i in parent.variables){
			if(!intrinsicVariables.hasOwnProperty(i)){
				xstyleCss.push(i,'=',parent.variables[i]);
			}
		}
	}
	visit(rootRule);
	return {
		standardCss: browserCss.join(''),
		xstyleCss: xstyleCss.join(';'),
		requiredModules: requiredModules
	};
}
if(typeof module != 'undefined' && require.main == module){
	main.apply(this, process.argv.slice(2));
}
