Xstyle is a framework for building applications through extensible CSS. With xstyle you
can define data bindings, UI elements, variables, extensions, and shims to create modern
web applications with an elegantly simple, stylesheet driven approach. Xstyle also includes
tools for loading CSS and building and minifying CSS-driven applications.

Much of the functionality in xstyle is still pre-alpha, but this documentation is annoted with
the stability of different functions. 

# Why Extensible CSS with xstyle?

Modern web browsers have increasingly moved towards relying on CSS to define the 
presentation of the user interface. Furthermore, CSS is fundamentally built on the 
powerful paradigms of declarative, function reactive programming, providing similar types of
expressiveness as dependency injection systems. By adding a few simple CSS constructs,
xstyle bridges the gap to provide the capabilities for composition and modular extensions that
allow virtually unlimited expression of user interfaces, with a familiar syntax. Xstyle goes
beyond the capabilities of preprocessor because it runs in the browser and extensions
can interact with the DOM. Xstyle prevents the common abuse of HTML for UI, by allowing
the definition of UI elements with the presentation definition, where they belong.  

# Getting Started
To start using xstyle's extensible CSS, you simply need to load the xstyle JavaScript library, <code>xstyle.js</code> and then @import
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

Using a module loader is beneficial, as it provides for automatic loading of extension
modules when they are used in CSS.

Xstyle also includes a CSS loader, for dynamically loading CSS as a dependency of modules.
See the AMD Plugin Loader section for more information.

# Using Xstyle CSS

Once you have loaded the xstyle script/module, you can begin to use xstyle's extensible CSS.

## Variables

The first key functionality in xstyle is variables. Variables can be assigned and used elsewhere
in CSS stylesheets. For many, this concept may be very familiar from CSS preprocessors, 
and the recent addition in modern browsers according to the W3C specification. 
Xstyle goes well beyond just value-replacement,
but we will start with the basics. First to create a variable, we use the '=' operator
to assign a value to a variable. For example, we could create a variable:

	highlightColor = blue;

To reference the variable and use the value in another property, xstyle uses the standard W3C
syntax, referencing the variable with a var(variable-name) syntax:

	.highlight {
		background-color: var(highlightColor);
	}

A variable can be declared at the top level, as well inside rules. A variable can referenced
that is within the current rule or any parent rule (see nested rules) including the top level.

This functionality is implemented but only lightly tested.

## Extending Rules

With xstyle, you can define that a CSS rule "extends" another rule, thus inheriting all
the properties and behavior from another rule. To extend another rule, start the rule
text with an <code>extends()</code> call, providing the base rule as the parameter:

	.base-rule {
		color: red;
		background-color: blue;
	}
	
	.sub-rule {
		extends(.base-rule); /* all the properties from base-rule will be inherited */
	}

The rule that is extending can define its properties that override the rules inherited from the base rule, for example:

	.sub-rule {
		extends(.base-rule);
		color: yellow; /* color is yellow, but we have inherited background-color of blue */ 
	}

This functionality is mostly implemented but only lightly tested, and may not be complete.

## Element Generation

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

You can create elements with ids and attributes as well, using standard selector syntax.
This will create a div with an id of "help" and a title of "Information":

	.all-tiles {
		=> div#help[title=Information];
	}

Element generation can also take advantage of a few CSS selector combinators as well.
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

This functionality is implemented and has received some testing.

## Nested Rules

With xstyle, you can nest CSS rules, allowing for multiple definitions using a given selector
prefix. For example, suppose we want to define several rules for elements within
.my-form. We can do so with nested rules:

.my-form {
	input {
		/* this rule's selector is equivalent to .my-form input */ 
	}
	selector {
		/* this rule's selector is equivalent to .my-form select */ 
	}
}

Using nesting rules can reduce typing, add better organization, and make it easier to refactor stylesheets.

### Nested Element Generation

Nesting rules is particularly useful in combination with element generation, as we can
define the CSS for the generated elements without having to manually create and
synchronize an element identifier or selector with another CSS rule.

	.content {
		=> 
			h1 'Green Header' {
				color: green;
			},
			p 'Blue Paragraph {
				color: blue;
			};
	}

We can nest element generation and CSS rules in any combination that we want, allowing
us to create sophisticated UI elements in a single modular unit. 

## Data Binding

We can combine variables with element generation to create data bindings. With data
bindings, an element can be generated and the contents can be bound to a variable.
A basic example of a data binding would be to create a variable with a string value:

	firstName = 'John';
	
	div.content {
		=> span(firstName);
	}

The contents of the span that was created would then be set to the value of firstName. Changes in the
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

### Attribute Binding

All elements have default binding. For input elements, bindings are bound to the input's 
"value" attribute, for other elements, to the text content of the element. However,
you can also bind to specific attributes of an element as well. This accomplished
by placing the paranthesis embedded binding reference in an attribute selector generator.
For example, we could bind the href of an anchor element to a variable:

	targetUrl = 'http://target/';
	.content {
		=> a[href=(targetUrl)];
	}

This functionality is implemented and has been lightly tested.

### List Binding

Not only can we bind scalar values to elements, we can also bind lists or array to elements
to generate a list of children elements corresponding to each item in an array. We bind
arrays just like we do scalar values. For example, we could easily output an array
of strings as a list like:

	.content {
		=> ul(arrayOfItems);
	}

Xstyle will iterate through the array, outputting a &lt;li/> element for each item, with the contents
corresponding to the item value. Different elements have different rendering for arrays, 
&lt;ul> and &lt;ol> elements will have have &lt;li> children, &lt;select>'s will have &lt;option> children,
and most others will have &lt;div> children.

You can also declare your own rendering of children by defining an "each" property for the 
targeted element. The
value of the each property should be a generating selector (just as we use with the => operator).
The item for each iteration in the array can be referenced with the "item" reference.
For example, we could generate a paragraph tag for each item:

	.content {
		=> div(arrayOfItems) {
			each: p(item);
		}
	}

This makes it possible to render arrays of objects. For example, we could render
a table of objects, where the first column corresponds to the "name" property of the
items in the array, and the second column corresponds to the "age" property:

	.content {
		=> table(arrayOfPeople) {
			each: tr {
				=> td(item/name), td(item/age);
			};
		};
	}

### Expressions

Data bindings can include more than just a plain variable reference, we can also write
expressions that include other JavaScript operators. For example, we could bind
to the value of concatenation of two strings (again a live binding, automatically updated if either
variable or property changes):

	h1.name {
		=> span(person/firstName + person/lastName);
	}

This functionality is implemented and has been lightly tested.


## Extensions and Shims

Xstyle allows one to define additional extensions to CSS. These extensions can be used for creating
custom components or for filling in missing functionality in browsers. Xstyle's default stylesheet
provides shims for a few commonly used properties that are missing in some older browsers,
including box-shadow, transform, and border-radius. For example, we can write:

	@import "xstyle/x.css";
	.my-class {
		box-shadow: 10px 10px 5px #888888;
		transform: rotate(10deg);
	}

Here, we can use newer CSS properties like 'box-shadow' and 'transform' and Xstyle
will shim (or "polyfill" or "fix") older browsers for you, transforming these to 
MS filters for older versions of Internet Explorer. 

Xstyle is plugin-based so that new shims and extensions can be selected and combined
without incurring additional CSS parsing overhead. Xstyle is designed to allow for plugins to be 
registered to handle different CSS properties, so that the shims and extensions that are
applied can be explicitly controlled for each stylesheet.

## Defining Extensions

We can also explicitly define our own properties and/or choose which CSS properties to shim 
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
However, we often want the shims to be conditional. For shims, we usually only want to apply the 
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


<h1>Creating Extension Modules</h1>
When you define custom CSS properties you can also create your own CSS extension modules/plugins.
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
use the 'addRenderer' property from the xstyle/xstyle module that will be executed for each
DOM element that matches the rule's selector.

This functionality has been mostly implemented and has been lightly tested.

### Included Extension Stylesheets

The x.css stylesheet (referenced in the example above) includes a number of out
of the box shims to upgrade older browsers for modern CSS properties including: opacity, box-shadow, 
border-radius, and transform (for some of these, browsers must at least support vender-prefixed versions of the properties).

The shims.css stylesheet also defines shims for pseudo selectors including hover and focus.
By @import'ing shims.css into a stylesheet, these shims will be defined and we can using.
The rule definitions are transitive, so if stylesheet A @import's stylesheet B, which @import's
shims.css, both A and B stylesheets will have the shims applied. If another stylesheet C is
later independently loaded and it doesn't import any stylesheets, none of the shims
will be applied to it.

Xstyle also includes an ext.css stylesheet that enables a number of CSS extensions
including :supported and :unsupported pseudo selectors, and an -x-widget CSS property
for instantiated widgets.
 
#### Available Shims (and limitations)
The following experimental shim modules come with Xstyle:
* shim/transition - This provides animated CSS property changes to emulates the CSS transition property.
* shim/boxOffsets - This provides absolute positioning in older versions of IE to emulate
bottom and right CSS properties.

#### Available Extensions
The following (mostly experimental) extension modules come with Xstyle:
* ext/pseudo - This modules provides emulation of hover, focus and other pseudos that
are not present in older versions of IE.
* ext/scrollbar - This module provides scrollbar measurement so that elements can be sized
based on the size of the scrollbar.
* ext/supported - Matches elements that have native support in the browser. For example:
	range:unsupported {
		/* styling for browsers that don't support range */
	}
	range:supported {
		/* styling for browsers that do support range */
	}
 
* ext/widget - This module can instantiate widgets to be applied to elements that match
a rule's selector. This is designed to instantiate widgets with the form of Widget(params, targetNode),
and can be used to instantiate Dojo's Dijit widgets.


## Widgets

One of the extensions included in xstyle is a property for declaring
widgets that follow the Dojo widget API (like Dijit widgets). In xstyle/ext.css this is
defined as the "widget" property. The value of the "widget" property should be a
nested rule with property definitions corresponding to the properties that should
be passed to the widget. There should also be a "type" property that indicates
the id of the module with the widget to load. For example, we could create progress
bar using dijit/ProgressBar, by defining it in a rule:

	.my-progress-bar {
		widget: {
			type: dijit/ProgressBar;
			maximum: 20;
			value: 10;
		}
	}

# Build

This functionality is not implemented yet.

Xstyle includes built tools that serve several purposes. First, they provide CSS aggregation,
combining @import'ed stylesheets into parent stylesheets to reduce requests. Second,
it will perform CSS minification, eliminating unnecessary whitespace and comments.
Xstyle will also isolate extensions into a special property that allows the xstyle parser
to run signficantly faster with built stylesheet. To run the build tool, run the build.js
with node, providing a path to a stylesheet or directory of stylesheets to process, and 
a target to save the stylesheet to. For example, if we want to build app.css, we could do:

node build.js app.css ../built/app.css

When used as an AMD plugin, xstyle can also integrate with a Dojo build, automatically
including CSS dependencies of modules in a build. To run utilize xstyle in a Dojo build,
you need to include the xstyle AMD build plugin. This can be specified in your build profile:

	plugins: {
		"xstyle/css": "xstyle/build/amd-css"
	},

After that, you can simply run a build as normal, and the CSS dependencies will 
automatically be inlined in the built layer.

While inlining CSS text in a JavaScript built layer is the easiest approach, and can also
help reduce the number of requests, it is generally preferable to keep CSS in stylesheets,
and leverage browser's optimized patterns for loading stylesheets. This can be accomplished
as well with the integrated Dojo build. You simply need to specify a target stylesheet
in the layer definition in the build profile:

	layers: [
	{
		name: "targetModule.js",
		targetStylesheet: "someStylesheet.js",
		...

When the build runs, any CSS dependencies that are encountered in modules will then
be added to someStylesheet.js, rather than inlined in the JavaScript build layer.

# AMD Plugin Loader

You can also use Xstyle as a CSS loader plugin for AMD loaders like Dojo and RequireJS. 
To use the CSS loader, use the AMD plugin syntax, with xstyle/css as the plugin loader
and the path to the stylesheet afterwards:

	require(['xstyle/css!path/to/stylesheet.css'], function(){
		// after after css is loaded
	});

Note, that simply using the plugin loader will not load xstyle, and trigger parsing of the stylesheet,
so you will not be able to use the extensions, unless you have specifically included
the xstyle module as well.

This functionality is implemented and has been well tested.
 
# Import Fixing

Another feature Xstyle provides is reliable @import behavior. Internet Explorer is not
capable of loading multiples levels deep @imports. Xstyle provides @import "flattening"
to fix this IE deficiency.

Xstyle also normalizes @import once behavior. If two stylesheets both @import the
same sheetsheet, Xstyle ensures that the @import'ed stylesheet is only imported once (by the first
stylesheet) and the second @import is removed. This is a powerful feature because
it allows stylesheets to @import another stylesheet without worrying about overriding
another stylesheet that expected to come after the target sheet due to it's @import statement.

# has-class

The has-class module provides decoration of the root &lt;html> element with class names
based on feature detection. The has-class module works in conjunction with the has()
module in Dojo (dojo/has) to detect features, and adds a class name for matches with
a "has-" prefix. For example, if we wanted to create a CSS rule that was conditional on the detection of
the "quirks" feature, first we would need to register this feature detection with the has-class module:

	define(['xstyle/has-class'], function(hasClass){
		hasClass("quirks");
	}); 

And then we could create a rule that uses this conditional class name:

	html.has-quirks .row {
		/* rule only applied if in quirks mode */
		height: auto;
	}

We can also base rules on the absence of a feature. In converse, we could create
a rule for when quirks mode is not present:

	hasClass("no-quirks");

And then use this in the selector:
	
	html.has-no-quirks .row {
		/* rule only applied if in quirks mode */
		width: auto;
	}

We can also base rules on a numerical feature values. We could create a rule that
just matches IE7 with:

	hasClass("ie-7");

Or version IE8 through IE10:

	hasClass("ie-8-10");
