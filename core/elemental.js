define(['xstyle/alkali/dom'], function(dom){

	var selectorRenderers = [];
	var renderQueue = [];
	var matchesRule = dom.matchesRule;
	var documentQueried;
	var doc = document;
	// probably want to inline our own DOM readiness code
	function domReady(callback){
		// TODO: support IE7-8
		if(/e/.test(doc.readyState||'')){
			// TODO: fix the issues with sync so this can be run immediately
			callback();
		}else{
			doc.addEventListener('DOMContentLoaded', callback);
		}
	}
	var testDiv = doc.createElement('div');
	var features = {
		'dom-qsa2.1': !!testDiv.querySelectorAll
	};
	function has(feature){
		return features[feature];
	}

	domReady(function(){
		if(!documentQueried){
			documentQueried = true;
			if(has('dom-qsa2.1')){
				// if we have a query engine, it is fastest to use that
				for(var i = 0, l = selectorRenderers.length; i < l; i++){
					// find the matches and register the renderers
					findMatches(selectorRenderers[i]);
				}
				// render all the elements that are queued up
				renderWaiting();
			}else{
			//else rely on css expressions (or maybe we should use document.all and just scan everything)
				var all = doc.all;
				for(var i = 0, l = all.length; i < l; i++){
					update(all[i]);
				}
			}
		}
	});
	function findMatches(renderer){
		// find the elements for a given selector and apply the renderers to it
		var results = doc.querySelectorAll(renderer.selector);
		var name = renderer.name;
		for(var i = 0, l = results.length; i < l; i++){
			var element = results[i];
			var currentStyle = element.elementalStyle;
			var currentSpecificities = element.elementalSpecificities;
			if(!currentStyle){
				currentStyle = element.elementalStyle = {};
				currentSpecificities = element.elementalSpecificities = {};
			}
			// TODO: only override if the selector is equal or higher specificity
			// var specificity = renderer.selector.match(/ /).length;
			if(true || currentSpecificities[name] <= renderer.specificity){ // only process changes
				var elementRenderings = element.renderings;
				if(!elementRenderings){
					// put it in the queue
					elementRenderings = element.renderings = [];
					renderQueue.push(element);
				}
				
				elementRenderings.push({
					name: name,
					rendered: currentStyle[name] == renderer.propertyValue,
					renderer: renderer
				});
				currentStyle[name] = renderer.propertyValue;
			}
		}
		
	}
	var isCurrent;
	function renderWaiting(){
		// render all the elements in the queue to be rendered
		while(renderQueue.length){
			var element = renderQueue.shift();
			var renderings = element.renderings, currentStyle = element.elementalStyle;
			while(renderings.length){
				var rendering = renderings.shift();
				var renderer = rendering.renderer;
				var rendered = renderer.rendered;
				// determine if this renderer matches the current computed style
				isCurrent = currentStyle[rendering.name] == renderer.propertyValue;
				if(!rendered && isCurrent){
					try{
						renderer.render(element);
					}catch(e){
						console.error(e, e.stack);
						var errorNode = element.appendChild(document.createElement('div'));
						errorNode.className = 'error';
						errorNode.appendChild(document.createTextNode(e.toString()));
					}
				}
				if(rendered && !isCurrent && renderer.unrender){
					renderer.unrender(element);
					//renderings.splice(j--, 1); // TODO: need to remove duplicate rendered items as well
				}
			}
			element.renderings = undefined;
		}
	}
	function update(element, selector){
		/* TODO: At some point, might want to use getMatchedCSSRules for faster access to matching rules
		if(typeof getMatchedCSSRules != 'undefined'){
			// webkit gives us fast access to which rules apply
			getMatchedCSSRules(element);
		}else{*/
		for(var i = 0, l = selectorRenderers.length; i < l; i++){
			var renderer = selectorRenderers[i];
			if((!selector || (selector == renderer.selector)) &&
				matchesRule(element, renderer.rule)){
				renderer.render(element);
			}
		}
	}
	function addRenderer(rule, handler){
		var renderer = {
			selector: rule.selector,
			rule: rule,
			render: handler
		};
		// the main entry point for adding elemental handlers for a selector. The handler
		// will be called for each element that is created that matches a given selector
		selectorRenderers.push(renderer);
		if(documentQueried){
			findMatches(renderer);
		}
		renderWaiting();
		/*if(!matchesSelector){
			// create a custom property to identify this rule in created elements
			return (renderers.triggerProperty = 'selector_' + encodeURIComponent(selector).replace(/%/g, '/')) + ': 1;' +
				(document.querySelectorAll ? '' : 
					// we use css expressions for IE6-7 to find new elements that match the selector, since qSA is not available, wonder if it is better to just use document.all...
					 'zoom: expression(cssxRegister(this,"' + selector +'"));');
		}*/
		return {
			remove: function(){
				selectorRenderers.splice(selectorRenderers.indexOf(renderer), 1);
			}
		};
	}
	return {
		ready: domReady,
		matchesRule: matchesRule,
		addRenderer: addRenderer,
		// this should be called for newly created dynamic elements to ensure the proper rules are applied
		update: update,
		clearRenderers: function(){
			// clears all the renderers in use
			selectorRenderers = [];
		}

	};
});