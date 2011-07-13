define(["./put"], function(put){
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
	return put;
});