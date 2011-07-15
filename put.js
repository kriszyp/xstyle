(function(define){
define([], function(){
	// module:
	//		xstyle/put
	// summary:
	//		This module defines a fast lightweight function for updating and creating new elements
	//		terse, CSS selector-based syntax. The single function from this module creates
	// 		new DOM elements with the signature:
	// 		put(referenceElement?, selector, properties|innerHTML);
	//		The first argument, referenceElement, is optional, and is the reference element
	//		for the selector. Tag syntax (no prefix) is used to indicate the tag to be created,
	//		.class-name can be used to assign the class name, #id can be used to assign an id.
	//		and [name=value] can be used to assign additional attributes to the element.
	// 		The attribute assignment will always use setAttribute to assign the attribute to the element.  
	//		For example, put("div.my-class") would create <div> element with a class of "my-class".
	//		(and appending to the referenceElement if provided). 
	//		CSS combinators can be used to create child elements and sibling elements.
	//		The create function returns the last top level element created or referenced (by a suffix combinator).
	//		See the documentations in doc/CREATE.md for more information and the
	//		tests in test/create.js for more examples.
	//	examples:
	//		To create a simple div with a class name of "foo":
	//		|	put("div.foo");
					
	var selectorParse = /(([-+])|[,<> ])?\s*(\.|!|#)?([-\w$]+)?(?:\[([^\]=]+)=?['"]?([^\]'"]*)['"]?\])?/g,
		fragmentFasterHeuristic = /[-+,> ]/, // if it has any of these combinators, it is probably going to be faster with a document fragment 	
		className = "className", undefined;
	try{
		var ieCreateElement = 1;
		put('i', {name:'a'});
	}catch(e){
		ieCreateElement = 0;
	}
	function put(){
		var fragment, nextSibling, topReferenceElement, referenceElement, current, args = arguments;
		function insertLastElement(finishFragment){
			// we perform insertBefore actions after the element is fully created to work properly with 
			// <input> tags in older versions of IE that require type attributes
			//	to be set before it is attached to a parent.
			// We also handle top level as a document fragment actions in a complex creation 
			// are done on a detached DOM which is much faster
			// Also if there is a parse error, we generally error out before doing any DOM operations (more atomic) 
			if(current && referenceElement && current != referenceElement){
				(referenceElement == topReferenceElement &&
					// top level, may use fragment for faster access 
					(fragment || 
						// fragment doesn't exist yet, check to see if we really want to create it 
						(fragment = fragmentFasterHeuristic.test(argument) && document.createDocumentFragment()))
							// any of the above fails just use the referenceElement  
							|| referenceElement).
								insertBefore(current, nextSibling); // do the actual insertion
			}
			if(finishFragment && topReferenceElement && fragment){
				// we now insert the top level elements for the fragment if it exists
				topReferenceElement.appendChild(fragment);
			}
		}
		for(var i = 0; i < args.length; i++){
			var argument = args[i];
			if(typeof argument == "object"){
				if(argument.nodeType){
					current = argument;
					insertLastElement(true);
					topReferenceElement = referenceElement = argument;
					nextSibling = fragment = null;
				}else{
					// an object hash
					for(var i in argument){
						current[i] = argument[i];
					}				
				}
			}else{
				var leftoverCharacters = argument.replace(selectorParse, function(t, combinator, siblingCombinator, prefix, value, attrName, attrValue){
					if(combinator){
						// insert the last current object
						insertLastElement();
						if(siblingCombinator){
							// + or - combinator, 
							// TODO: add support for >- as a means of indicating before the first child?
							referenceElement = (nextSibling = (current || referenceElement)).parentNode;
							current = null;
							if(siblingCombinator == "+"){
								nextSibling = nextSibling.nextSibling;
							}// else a - operator, again not in CSS, but obvious in it's meaning (create next element before the current/referenceElement)
						}else{
							if(combinator == "<"){
								// parent combinator (not really in CSS, but theorized, and obvious in it's meaning)
								referenceElement = current = (current || referenceElement).parentNode;
							}else{
								if(combinator == ","){
									// comma combinator, start a new selector
									referenceElement = topReferenceElement;
								}else{
									// else descendent or child selector (doesn't matter, treated the same),
									referenceElement = current;
								}
								current = null;
							}
							nextSibling = null;
						}
						if(current){
							referenceElement = current;
						}
					}
					var tag = !prefix && value;
					if(tag || (!current && (prefix || attrName))){
						// Need to create an element
						tag = tag || put.defaultTag;
						if(tag == "$"){
							// a scalar value, use createTextNode so it is properly escaped
							current = document.createTextNode(args[++i]);
						}else{
							if(ieCreateElement && args[i +1] && args[i +1].name){
								// in IE, we have to use the crazy non-standard createElement to create input's that have a name 
								tag = '<' + tag + ' name="' + properties.name + '">';
							}
							current = document.createElement(tag);
						}
					}
					if(prefix){
						if(value == "$"){
							value = args[++i];
						}
						if(prefix == "."){
							// .class-name was specified
							current[className] = current[className] ? current[className] + ' ' + value : value;
						}else if(prefix == "!"){
							if(argument == "!"){
								// special signal to delete this element
								// use the ol' innerHTML trick to get IE to do some cleanup
								put("div").appendChild(current).innerHTML = "";
							}					
							// CSS class removal
							var untrimmed = (" " + current[className] + " ").replace(" " + value + " ", " ");
							current[className] = untrimmed.substring(1, untrimmed.length - 1); 
						}else{
							// #id was specified
							current.id = value;
						}
					}
					if(attrName){
						if(attrValue == "$"){
							attrValue = args[++i];
						}
						// [name=value]
						if(attrName == "style"){
							// handle the special case of setAttribute not working in old IE
							current.style.cssText = attrValue;
						}else{
							current[attrName.charAt(0) == "!" ? (attrName = attrName.substring(1)) && 'removeAttribute' : 'setAttribute'](attrName, attrValue || attrName);
						}
					}
					return '';
				});
				if(leftoverCharacters){
					throw new SyntaxError("Unexpected char " + leftoverCharacters + " in " + argument);
				}
				insertLastElement(true);
			}
		}
		return current;
	}
	put.defaultTag = "div";
	return put;
});
})(typeof define == "undefined" ? function(deps, factory){
	put = factory();
} : define);