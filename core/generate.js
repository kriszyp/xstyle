define('xstyle/core/generate', [
	'xstyle/core/elemental',
	'put-selector/put',
	'xstyle/core/utils',
	'xstyle/core/expression',
	'xstyle/core/base',
	'xstyle/core/Proxy'
], function(elemental, put, utils, expressionModule, root, Proxy){
	// this module is responsible for generating elements with xstyle's element generation
	// syntax and handling data bindings
	// selection of default children for given elements
	var childTagForParent = {
		TABLE: 'tr',
		TBODY: 'tr',
		TR: 'td',
		UL: 'li',
		OL: 'li',
		SELECT: 'option'
	};
	var inputs = {
		INPUT: 1,
		TEXTAREA: 1,
		SELECT: 1
	};
	var doc = document;
	function forSelector(generatingSelector, rule){
		// this is responsible for generation of DOM elements for elements matching generative rules
		// normalize to array
		generatingSelector = generatingSelector.sort ? generatingSelector : [generatingSelector];
		// return a function that can do the generation for each element that matches
		return function(element, item, beforeElement){
			var lastElement = element;
			element._defaultBinding = false;
			if(beforeElement === undefined){
				var childNodes = element.childNodes;
				var childNode = childNodes[0], contentFragment;
				// move the children out and record the contents in a fragment
				if(childNode){
					contentFragment = doc.createDocumentFragment();
					do{
						contentFragment.appendChild(childNode);
					}while(childNode = childNodes[0]);
				}
			}
			// temporarily store it on the element, so it can be accessed as an element-property
			// TODO: remove it after completion
			if(!element.content && contentFragment){
				element.content = contentFragment;
			}
			var indentationLevel = 0;
			var indentationLevels = [element];
			var stackOfElementsToUpdate = [];
			for(var i = 0, l = generatingSelector.length;i < l; i++){
				// go through each part in the selector/generation sequence
				// TODO: eventually we should optimize for inserting nodes detached
				var lastPart = part,
					part = generatingSelector[i];
				try{
					if(part.eachProperty){
						// it's a rule or call
						if(part.args){
							if(part.operator == '('){ // a call (or at least parans), for now we are assuming it is a binding
								var nextPart = generatingSelector[i+1];
								if(nextPart && nextPart.eachProperty){
									// apply the class for the next part so we can reference it properly
									put(lastElement, nextPart.selector);
								}
								// TODO: make sure we only do this only once
								var expression = part.getArgs()[0];
								var expressionResult = expressionModule.evaluate(part.parent, expression);
								
								renderExpression(lastElement, nextPart, expressionResult, rule, expression);
							}else{// brackets
								put(lastElement, part.toString());
							}
						}else{
							// it is plain rule (not a call), we need to apply the 
							// auto-generated selector, so CSS is properly applied
							put(lastElement, part.selector);
							// do any elemental updates
							stackOfElementsToUpdate.push(part.selector, lastElement);
						}
					}else if(typeof part == 'string'){
						// actual CSS selector syntax, we generate the elements specified
						if(part.charAt(0) == '='){
							part = part.slice(1); // remove the '=' at the beginning					
						}
				
						// TODO: inline our own put-selector code, and handle bindings
/*								child = child.replace(/\([^)]*\)/, function(expression){
									reference = expression;
								});
								/*if(!/^\w/.test(child)){
									// if it could be interpreted as a modifier, make sure we change it to really create a new element
									child = '>' + child;
								}*/
						var nextElement = lastElement;
						var nextPart = generatingSelector[i + 1];
						// parse for the sections of the selector
						var parts = [];
						part.replace(/([,\n]+)?([\t ]+)?(\.|#)?([-\w%$|\.\#]+)(?:\[([^\]=]+)=?['"]?([^\]'"]*)['"]?\])?/g, function(){
							parts.push(arguments);
						});
						// now iterate over these
						for(var j = 0;j < parts.length; j++){
							(function(t, nextLine, indentation, prefix, value, attrName, attrValue){
								function positionForChildren(){
									var contentNode = nextElement._contentNode;
									if(contentNode){
										// we have a custom element, that has defined a content node.
										contentNode.innerHTML = '';
										nextElement = contentNode;
									}
								}
								if(indentation){
									if(nextLine){
										var newIndentationLevel = indentation.length;
										if(newIndentationLevel > indentationLevel){
											positionForChildren();
											// a new child
											indentationLevels[newIndentationLevel] = nextElement;
										}else{
											// returning to an existing parent
											nextElement = indentationLevels[newIndentationLevel] || nextElement;
										}
										indentationLevel = newIndentationLevel;
									}else{
										positionForChildren();
									}
	//								nextElement = element;
								}else{
									positionForChildren();
								}
								var selector;
								if(prefix){// we don't want to modify the current element, we need to create a new one
									selector = (lastPart && lastPart.args ?
										// if the last part was brackets or a call, we can
										// continue modifying the same element
										'' :
										'span') + prefix + value;
								}else{
									var tagName = value.match(/^[-\w]+/)[0];
									var target = rule.getDefinition(tagName);
									// see if we have a definition for the element
									if(target && (target.then || target.newElement)){
										nextElement = (function(nextElement, beforeElement, value, tagName){
											var newElement, placeHolder;
											// this may be executed async, we need to be ready with a place holder
											utils.when(target, function(target){
												if(target.newElement){
													newElement = target.newElement();

													// apply the rest of the selector
													value = value.slice(tagName.length);
													if(value){
														put(newElement, value);
													}
												}else{
													newElement = put(value);
												}
												if(placeHolder){
													// a placeholder was created, replace it with the new element
													placeHolder.parentNode.replaceChild(newElement, placeHolder);
													var childNodes = placeHolder.childNodes;
													var childNode;
													// now move any children into the new element (or its content node)
													newElement = newElement._contentNode || newElement;
													while(childNode = childNodes[0]){
														newElement.appendChild(childNode);
													}
												}
											});
											if(newElement){
												// executed sync, just insert
												return nextElement.insertBefore(newElement, beforeElement || null);
											}else{
												// it was async, put in a placeholder
												var placeHolder = put('span');
												return nextElement.insertBefore(placeHolder, beforeElement || null);
											}
										})(nextElement, beforeElement, value, tagName);
									}else{
										selector = value;
									}
								}
								if(selector){
									nextElement = put(beforeElement || nextElement,
										(beforeElement ? '-' : '') + selector);
								}
								beforeElement = null;
								if(attrName){
									attrValue = attrValue === '' ? attrName : attrValue;
									nextElement.setAttribute(attrName, attrValue);
								}
								if(item){
									// set the item property, so the item reference will work
									nextElement.item = item;
								}
								if(j < parts.length - 1 || (nextElement != lastElement &&
									// avoid infinite loop if it is a nop selector
									nextElement != element &&
									// if the next part is a rule, than it should be extending it
									// already, so we don't want to double apply
									(!nextPart || !nextPart.base)
									)){
									stackOfElementsToUpdate.push(null, nextElement);
								}
								lastElement = nextElement;
							}).apply(this, parts[j]);
						}
					}else{
						// a string literal
						lastElement.appendChild(doc.createTextNode(part.value));
					}
				}catch(e){
					console.error(e, e.stack);
					lastElement.appendChild(doc.createTextNode(e));
				}
			}
			// now go back through and make updates to the elements, we do it in reverse
			// order so we can affect the children first
			while(elementToUpdate = stackOfElementsToUpdate.pop()){
				elemental.update(elementToUpdate, stackOfElementsToUpdate.pop());
			}
			return lastElement;
		};

	}

	function renderExpression(element, nextPart, expressionResult, rule, expression){
		var contentProxy = element.content || (element.content = new Proxy());
		utils.when(expressionResult, function(result){
			// TODO: assess how we could propagate changes categorically
			if(result.forElement){
				result = result.forElement(element);
				// now apply.element should indicate the element that it is actually
				// keying or varying on
			}
			// We want to contextualize this for the parent (forParent), but
			// we need to differentiate it from the forParent that rules do that create
			// a new rule-specific instances (hence the flag)
			if(result.forParent){
				// if the result can be specific to a rule, apply that context
				result = result.forParent(rule, expression, true);
			}
			contentProxy.setSource(result);
		});
		if(!('_defaultBinding' in element)){
			// if we don't have any handle for content yet, we install this default handling
			element._defaultBinding = true;
			var textNode = element.appendChild(doc.createTextNode('Loading'));
			contentProxy.observe(function(value){
				if(element._defaultBinding){ // the default binding can later be disabled
					if(value && value.sort){
						if(textNode){
							// remove the loading node
							textNode.parentNode.removeChild(textNode);
							textNode = null;
						}
						if(value.isSequence){
							forSelector(value, part.parent)(element, item, beforeElement);
						}else{
							element.innerHTML = '';
							// if it is an array, we do iterative rendering
							var eachHandler = nextPart && nextPart.eachProperty &&
								nextPart.each;
							// we create a rule for the item elements
							var eachRule = rule.newRule();
							// if 'each' is defined, we will use it render each item 
							if(eachHandler){
								eachHandler = forSelector(eachHandler, eachRule);
							}else{
								eachHandler = function(element, value, beforeElement){
									// if there no each handler, we use the default
									// tag name for the parent 
									return put(beforeElement || element, (beforeElement ? '-' : '') +
										(childTagForParent[element.tagName] || 'span'), '' + value);
								};
							}
							var rows = value.map(function(value){
								// TODO: do this inside generate
								return eachHandler(element, value, null);
							});
							if(value.observe){
								value.observe(function(object, previousIndex, newIndex){
									if(previousIndex > -1){
										var oldElement = rows[previousIndex];
										oldElement.parentNode.removeChild(oldElement);
										rows.splice(previousIndex, 1);
									}
									if(newIndex > -1){
										rows.splice(newIndex, 0, eachHandler(element, object, rows[newIndex] || null));
									}
								}, true);
							}
						}
					}else if(value && value.nodeType){
						if(textNode){
							// remove the loading node
							textNode.parentNode.removeChild(textNode);
							textNode = null;
						}
						element.appendChild(value);
					}else{
						value = value === undefined ? '' : value;
						if(element.tagName in inputs){
							// add the text
							element.value = value;
							// we are going to store the variable computation on the element
							// so that on a change we can quickly do a put on it
							// we might want to consider changing that in the future, to
							// reduce memory, but for now this probably has minimal cost
							element['-x-variable'] = contentProxy;
						}else{
							// put text in for Loading until we are ready
							// TODO: we should do this after setting up the observe
							// in case we synchronously get the data
							// if not an array, render as plain text
							textNode.nodeValue = value;
						}
					}
				}
			});
		}
	}
	function generate(parentElement, selector){
		return forSelector(selector, root)(parentElement);
	}
	generate.forSelector = forSelector;
	return generate;
});