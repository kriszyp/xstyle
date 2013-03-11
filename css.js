define(["require"], function(moduleRequire){
"use strict";
var cssCache = window.cssCache || (window.cssCache = {});
/*
 * AMD css! plugin
 * This plugin will load and wait for css files.  This could be handy when
 * loading css files as part of a layer or as a way to apply a run-time theme. This
 * module checks to see if the CSS is already loaded before incurring the cost
 * of loading the full CSS loader codebase
 */
 	function testElementStyle(tag, id, property){
 		// test an element's style
		var docElement = document.documentElement;
		var testDiv = docElement.insertBefore(document.createElement(tag), docElement.firstChild);
		testDiv.id = id;
		var styleValue = (testDiv.currentStyle || getComputedStyle(testDiv, null))[property];
		docElement.removeChild(testDiv);
 		return styleValue;
 	} 
 	return {
		load: function(resourceDef, require, callback, config) {
			var url = require.toUrl(resourceDef);
			var cachedCss = cssCache[url];
			if(cachedCss){
				return createStyleSheet(cachedCss);
			}
			function checkForParser(){
				var parser = testElementStyle('x-parse', null, 'content');
				if(parser){
					// TODO: wait for parser to load
					require([parser], callback);
				}else{
					callback();
				}
			}
			
			// if there is an id test available, see if the referenced rule is already loaded,
			// and if so we can completely avoid any dynamic CSS loading. If it is
			// not present, we need to use the dynamic CSS loader.
			var displayStyle = testElementStyle('div', require.toAbsMid(resourceDef).replace(/\//g,'-').replace(/\..*/,'') + "-loaded", 'display');
			if(displayStyle == "none"){
				return checkForParser();
			}
			// use dynamic loader
			moduleRequire(["./load-css"], function(load){
				load(url, checkForParser);
			});
		},
		pluginBuilder: "xstyle/css-builder"

	};
});
