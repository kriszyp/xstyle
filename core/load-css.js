define([], function(){
	'use strict';
	// this module is responsible for doing the loading/insertion
	// of stylesheets to get CSS loaded.

	var cache = typeof _css_cache == 'undefined' ? {} : _css_cache;
	var doc = document;

	function has(){
		return !doc.createStyleSheet;
	}
	var head = doc.head;
	function insertCss(css){
		if(has("dom-create-style-element")){
			// we can use standard <style> element creation
			styleSheet = doc.createElement("style");
			styleSheet.setAttribute("type", "text/css");
			styleSheet.appendChild(doc.createTextNode(css));
			head.insertBefore(styleSheet, head.firstChild);
			return styleSheet;
		}
		else{
			// IE's stylesheet insertion
			var styleSheet = doc.createStyleSheet();
			styleSheet.cssText = css;
			return styleSheet.owningElement;
		}
	}

	function load(resourceDef, callback, options){
		var cached = cache[resourceDef];
		if(cached){
			// if it is cached (from a build), we directly insert
			link = insertCss(cached);
			return callback(link);
		}
		// create a link element to load the stylesheet
		var link = doc.createElement('link');
		link.type = 'text/css';
		link.rel = 'stylesheet';
		link.href = resourceDef;
		var wait = !options || options.wait !== false;
		// all browsers support this onload function now
		link.onload = function(){
			// cleanup
			link.onload = null;
			link.onerror = null;
			wait && callback(link);
		};
		// always add the error handler, so we can notify of any errors
		link.onerror = function(){
			// there isn't really any recourse in AMD for errors, so
			// we just output the error and continue on
			console.error('Error loading stylesheet ' + resourceDef);
			wait && callback(link);
		};
		// add it to the head to trigger loading
		(head || doc.getElementsByTagName('head')[0]).appendChild(link);
		if(!wait){
			// don't wait for the stylesheet to load, proceed
			callback(link);
		}
	}
	load.insertCss = insertCss;
	return load;
});
