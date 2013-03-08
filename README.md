Xstyle is a framework for building applications through extensible CSS. With xstyle you
can define data bindings, UI elements, variables, extensions, and shims to create modern
web applications with an elegantly simple, stylesheet driven approach.

# Why Extensible CSS with xstyle?

Modern web browsers have increasingly moved towards relying on CSS to define the 
presentation of the user interface. Furthermore, CSS is fundamentally built on the 
powerful paradigms of declarative, function reactive programming, providing similar types of
expressiveness as dependency injection systems. By adding a few simple CSS constructs,
bridges the gap to provide the capabilities for composition and modular extensions that
allow virtually unlimited expression of user interfaces, with a familiar syntax. Xstyle goes
beyond the capabilities of preprocessor because it runs in the browser and extensions
can interact with the DOM. Xstyle prevents the common abuse of HTML for UI, by allowing
the definition of UI elements with the presentation definition, where they belong.  

# Getting Started
To start using xstyle, you simply need to load the xstyle JavaScript library, <code>xstyle.js</code> and then @import
xstyle's <code>x.css</code> stylesheet within your stylesheet that will be using CSS extensions:

<pre>
&lt;style>
	@import 'xstyle/x.css';
	/* my rules */	
&lt;/style>
&lt;script src="xstyle/xstyle.js">&lt;/script>
</pre>

Or xstyle can be used with an AMD module loader, like Dojo:
<pre>
&lt;style>
	@import 'xstyle/x.css';
	/* my rules */	
&lt;/style>
&lt;script src="dojo/dojo.js">&lt;/script>
&lt;script>
	require(['xstyle/xstyle']);
&lt;/script>
</pre>
Using a module loader is recommended, as it provides for automatic 

# Variables

The first concept to learn in xstyle is variables. Variables can be assigned and used elsewhere
in stylesheets. For many, this concept may be very familiar from CSS preprocessors, 
and the recent addition in modern browsers according to the W3C specification. 
Xstyle goes well beyond just value-replacement,
but we will start with the basics. First to create a variable, we use the '=' operator
to assign a value to a variable. For example, we could create a variable:

	highlightColor = blue;

To reference the variable and use value in another property, xstyle uses the W3C
syntax, referencing the variable with a var(variable-name) syntax:

	.highlight {
		color: var(highlightColor);
	}

# Element Generation

With xstyle, you can declare the creation of elements within rules, allowing for the creation
of complex presentation components without abusing HTML for presentation. This not only 
simplifies the creation and composition of UI components, it helps to keep cleaner semantics in HTML.

To create an element, we use the => operator, followed a selector designating the 
tag of the element to create along with class names, id, and attributes to assign to the element.
For example, we could create a &lt;div> with an class name of "tile" inside of any element
with a class name of "all-tiles":

	.all-tiles {
		=> div.tile;
	}

Element generation can take advantage of a few CSS selector combinators as well.
We can use spaces to create child elements and use commas to separate different
elements to create. For example, we could create a two row table:

	table.two-row {
		=>
			tr td,
			tr td;
	}  

We could also generate text nodes inside elements with quoted strings. We could create
an h1 header with some text like:

	header {
		=> h1 'The header of the page';

# Data Binding

We can combine variables with element generation to create data bindings. With data
bindings, an element can be generated and the contents can be bound to a variable.
A basic example of a data binding would be to create a variable with a string value:

	firstName = 'John';
	
	div.content {
		=> span(firstName);
	}

The value of firstName would then be set to the value of firstName. Changes in the
value of the firstName would automatically be updated in the span's contents.

We can also bind variables to inputs, and then the binding will work two ways, not only can 
changes in the variable be reflected in the input, but user edits to the value will be updated
to the variable. For example:

	firstName = 'John';
	
	div.content {
		=> input[type=text](firstName);
	}

This provides the foundation for wiring components to data sources. We can also assign
variables to modules, providing an interface between JavaScript-driven data and the UI.
We bind a variable to a module like this:

	person = require(data/person);
 
We can then bind to the object returned from the module. We use a / operator to refer
to properties of an object:

	form.content {
		=> 
			label 'First Name:',
			input[type=text](person/firstName),
			label 'Last Name:',
			input[type=text](person/lastName);
	}

## Expressions

Data bindings can include more than just a plain variable reference, we can also write
expressions that include other JavaScript operators. For example, we could bind
to the value of concatenation of two strings (again a live binding, updated if either
variable or property changes):

	h1.name {
		=> span(person/firstName + person/lastName);
	}

# Extensions and Shims

Xstyle allows one to define extensions to CSS. These extensions can be used for creating
custom components or for filling in missing functionality in browsers. Xstyle includes
a shimming stylesheet that provides shims for a few commonly used properties that
are missing in some older browsers. For example:

	@import "/path/to/xstyle/shims.css";
	.my-class {
		box-shadow: 10px 10px 5px #888888;
		transform: rotate(10deg);
	}

Here, we can use newer CSS properties like 'box-shadow' and 'transform' and Xstyle
will shim (or "polyfill" or "fix") older browsers for you. Xstyle will scan your stylesheet, load the shims.css which defines the CSS extensions
for the rules for shimming, and process the stylesheet. 

You can also use Xstyle as a CSS loader plugin for AMD loaders like Dojo and RequireJS:
<pre>
define(["xstyle!./path/to/example.css"], function(){
	// module starts after css is loaded
});
</pre>

Xstyle is plugin-based so that new shims and extensions can be selected and combined
without incurring additional CSS parsing overhead. Xstyle is designed to allow for plugins to be 
registered to handle different CSS properties, so that the shims and extensions that are
applied can be explicilty controlled for each stylesheet.

The shims.css stylesheet (referenced in the example above) includes a number of out
of the box shims to upgrade older browsers for modern CSS properties including: opacity, 
bottom, right, transition, box-shadow, box-radius, box-sizing, border-image, transform
(for some of these, browsers must at least support vender-prefixed versions of the properties).
The shims.css stylesheet also defines shims for pseudo selectors including hover and focus.
By @import'ing shims.css into a stylesheet, these shims will be defined and we can using.
The rule definitions are transitive, so if stylesheet A @import's stylesheet B, which @import's
shims.css, both A and B stylesheets will have the shims applied. If another stylesheet C is
later independently loaded and it doesn't import any stylesheets, none of the shims
will be applied to it.

Xstyle also includes an ext.css stylesheet that enables a number of CSS extensions
including :supported and :unsupported pseudo selectors, and an -x-widget CSS property
for instantiated widgets. 

We can also explicitly define exactly which properties and other CSS elements to shim 
or extend. The Xstyle parser looks for extension rules. The first rule is x-property
which defines how a CSS property should be handled. A rule with an 'x-property' selector
make define properties with values indicating how the corresponding CSS property 
should be handled. Let's look at a simplified example from shims.css to see how we 
could shim the 'box-shadow' property to use an IE filter:
<pre>
x-property {
	box-shadow: require(xstyle/shim/ie-filter);
}		
</pre>
Here we defined that the CSS property 'box-shadow' should be handled by the 'xstyle/shim/ie-filter' 
module. The ie-filter module converts the CSS property to an MS filter property so that
we can enable a box shadow in IE. Now, we could later create a rule that uses this property:
<pre>
.my-box: {
	box-shadow: 10px 10px 5px #888888;
}
</pre>
However, this was indeed a simplified. For shims, we usually only want to apply the 
shimming module if the property is not natively supported. We can do this with the
default and prefix property values. The rule in shims.css looks like this:
<pre>
x-property {
	box-shadow: default, prefix, require(xstyle/shim/ie-filter);
}		
</pre>
This extension rule includes multiple, comma separated values. The first value is 'default'.
This indicates that first Xstyle should check if the 'box-shadow' is natively supported
by the browser in standard form. If it is, then no further extensions or modifications to the CSS are applied.
The next value is 'prefix'. This indicates that first Xstyle should check if the 'box-shadow' 
is supported by the browser with a vendor prefix (like -webkit- or -moz-). If it is, then 
the vendor prefix is added to the CSS property to enable it. Finally, if 'box-shadow' is
not supported in standard form or with a vendor prefix, then the ie-filter module is
loaded to apply the MS filter.
 
<h1>Import Fixing</h1>
Another feature Xstyle provides is reliable @import behavior. Internet Explorer is not
capable of loading multiples levels deep @imports. Xstyle provides @import "flattening"
to fix this IE deficiency.

Xstyle also normalizes @import once behavior. If two stylesheets both @import the
same sheetsheet, Xstyle ensures that the @import'ed stylesheet is only imported once (by the first
stylesheet) and the second @import is removed. This is a powerful feature because
it allows stylesheets to @import another stylesheet without worrying about overriding
another stylesheet that expected to come after the target sheet due to it's @import statement.

<h1>Available Shims (and limitations)</h1>
The following shim modules come with Xstyle:
* xstyle - Xstyle itself provide vendor prefix shimming with the prefix property. This is
used to shim border-radius, box-shadow, box-sizing, and border-image (for browsers 
that use support these properties with vendor prefixes).
* shim/ie-filter - This creates MS filters to emulate standard CSS properties. This is used to shim
box-shadow and transform.
* shim/transition - This provides animated CSS property changes to emulates the CSS transition property.
* shim/boxOffsets - This provides absolute positioning in older versions of IE to emulate
bottom and right CSS properties.

<h1>Available Extensions</h1>
The following shim modules come with Xstyle:
* ext/pseudo - This modules provides emulation of hover, focus and other pseudos that
are not present in older versions of IE.
* ext/scrollbar - This module provides scrollbar measurement so that elements can be sized
based on the size of the scrollbar.
* ext/supported - 
* ext/widget - This module can instantiate widgets to be applied to elements that match
a rule's selector. This is designed to instantiate widgets with the form of Widget(params, targetNode),
and can be used to instantiate Dojo's Dijit widgets.


<h1>Creating Extension Modules</h1>
Xstyle is a plugin-based and you are encouraged to create your own CSS extension modules/plugins.
An extension module that handles extension properties should return an object with an 
onProperty function that will be called each time the extension property is encountered.
The onProperty function has the signature:
<pre>
onProperty(name, value, rule);
</pre>
Where 'name' is the CSS property name, 'value' is the value of the property, and 'rule'
is an object representing the whole rule. The onProperty function can return CSS properties
in text form to easily provide substitutionary CSS.

Extension modules may need to do more sophisticated interaction than just CSS replacement.
If an extension module needs to actually interact with and manipulate the DOM, it may
use the 'elemental' module to add an element renderer that will be executed for each
DOM element that matches the rule's selector.
