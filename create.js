(function(define){
define([], function(){
	// module:
	//		cssx/create
	// summary:
	//		This module defines a fast lightweight function for creating new elements
	//		terse, CSS selector-based syntax. The single function from this module creates
	// 		new DOM elements with the signature:
	// 		create(referenceElement?, selector, properties|innerHTML);
	//		The first argument, referenceElement, is optional, and is the reference element
	//		for the selector. Tag syntax (no prefix) is used to indicate the tag to be created,
	//		.class-name can be used to assign the class name, #id can be used to assign an id.
	//		and [name=value] can be used to assign additional attributes to the element.
	// 		The attribute assignment will always use setAttribute to assign the attribute to the element.  
	//		For example, create("div.my-class") would create <div> element with a class of "my-class".
	//		(and appending to the referenceElement if provided). 
	//		CSS combinators can be used to create child elements and sibling elements.
	//		The create function returns the last top level element created or referenced (by a suffix combinator).
	//		See the documentations in doc/CREATE.md for more information and the
	//		tests in test/create.js for more examples.
	//	examples:
	//		To create a simple div with a class name of "foo":
	//		|	create("div.foo");
					
	var selectorParse = /(([-+])|[,<> ])?\s*(\.|#)?([-\w]+)?(?:\[([^\]=]+)=?['"]?([^\]'"]*)['"]?\])?/g,
		fragmentFasterHeuristic = /[-+,> ]/; // if it has any of these combinators, it is probably going to be faster with a document fragment 	
		className = "className", undefined;
	function create(referenceElement, selector, properties){
		if(typeof referenceElement == "string"){
			// first parameter is optional,
			properties = selector;
			selector = referenceElement;
			referenceElement = null;
		}
		var fragment, nextSibling = null, current, topReferenceElement = referenceElement;
		function insertLastElement(){
			// we perform insertBefore actions after the element is fully created to work properly with 
			// <input> tags in older versions of IE that require type attributes
			//	to be set before it is attached to a parent.
			// We also handle top level as a document fragment actions in a complex creation 
			// are done on a detached DOM which is much faster
			// Also if there is a parse error, we generally error out before doing any DOM operations (more atomic) 
			if(current && referenceElement){
				(referenceElement == topReferenceElement &&
					// top level, may use fragment for faster access 
					(fragment || 
						// fragment doesn't exist yet, check to see if we really want to create it 
						(fragment = fragmentFasterHeuristic.test(selector) && document.createDocumentFragment()))
							// any of the above fails just use the referenceElement  
							|| referenceElement).
								insertBefore(current, nextSibling); // do the actual insertion
			}
		}
		var leftoverCharacters = selector.replace(selectorParse, function(t, combinator, siblingCombinator, prefix, value, attrName, attrValue){
			if(combinator){
				// insert the last current object
				insertLastElement();
				if(siblingCombinator){
					// + or - combinator, 
					referenceElement = (nextSibling = (current || referenceElement)).parentNode;
					if(siblingCombinator == "+"){
						nextSibling = nextSibling.nextSibling;
					}// else a - operator, again not in CSS, but obvious in it's meaning (create next element before the current/referenceElement)
				}else{
					if(combinator == "<"){
						// parent combinator (not really in CSS, but theorized, and obvious in it's meaning)
						current = (current || referenceElement).parentNode;
					}else if(combinator == ","){
						// comma combinator, start a new selector
						current = topReferenceElement;
					}
					// else descendent or child selector (doesn't matter, but treated the same),
					referenceElement = current;
					current = null;
					nextSibling = null;
				}
			}
			var tag = !prefix && value;
			if(tag || (!current && (prefix || attrName))){
				// Need to create an element
				current = document.createElement(tag || create.defaultTag);
			}
			if(prefix){
				if(prefix == "."){
					// .class-name was specified
					current[className] = current[className] ? current[className] + ' ' + value : value;
				}else{
					// #id was specified
					current.id = value;
				}
			}
			if(attrName){
				// [name=value]
				if(attrName == "style"){
					// handle the special case of setAttribute not working in old IE
					current.style.cssText = attrValue;
				}else{
					current.setAttribute(attrName, attrValue || attrName);
				}
			}
			return '';
		});
		if(leftoverCharacters){
			throw new SyntaxError("Unexpected char " + leftoverCharacters);
		}
		var returnElement = current || referenceElement;
		if(properties !== undefined){
			if(typeof properties == "object"){
				// an object hash
				for(var i in properties){
					returnElement[i] = properties[i];
				}
			}else{
				// a scalar value, use createTextNode so it is properly escaped
				returnElement.appendChild(document.createTextNode(properties));
			}
		}
		// insert the last element (if it didn't end with a combinator)
		insertLastElement();
		if(topReferenceElement && fragment){
			// we now insert the top level elements for the fragment if it exists
			topReferenceElement.appendChild(fragment);
		}
		return returnElement;
	}
	create.defaultTag = "div";
	return create;
});
})(typeof define == "undefined" ? function(deps, factory){create = factory();} : define);