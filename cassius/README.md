Cassius is an AMD CSS loader, along with a few CSS utilities, including a CSS parser, with extensibility hooks, feature-based document element application, and corresponding build tools.

# Build

This functionality is partially implemented.

cassius includes built tools that serve several purposes. First, they provide CSS aggregation,
combining @import'ed stylesheets into parent stylesheets to reduce requests. Second,
it will perform CSS minification, eliminating unnecessary whitespace and comments.
cassius will also isolate extensions into a special property that allows the cassius parser
to run signficantly faster with a built stylesheet. To run the build tool, run the build.js
with node, providing a path to a stylesheet or directory of stylesheets to process, and 
a target to save the stylesheet to. For example, if we want to build app.css, we could do:

	node build.js app.css ../built/app.css

The cassius build tool is also capable of inline resources like images directly in the stylesheet
with data: URLs. This can be very useful for reducing the number of requests. To mark resources for inlining, simply append a hash of #inline to the URL of the resource.
For example, if we had a background image pointing back.png, we could write the following rule

	.content {
		background: url(back.png#inline);
	}

When the build tool runs, this URL will be transformed to a data URL, and no extra request
will be necessary to fetch this background image. While this can reduce the number of
requests, this is best used for images that are small and very likely to be used. Since
the URL is inline in the stylesheet, it increases the load time of the stylesheet, and 
if the image might not be used or is large, this may be more detrimental than the 
improved overall load time afforded by the reduced requests.

# AMD Plugin Loader

You can also use cassius as a CSS loader plugin for AMD loaders like Dojo and RequireJS. 
To use the CSS loader, use the AMD plugin syntax, with cassius/css as the plugin loader
and the path to the stylesheet afterwards:

	require(['cassius/css!path/to/stylesheet.css'], function(){
		// after after css is loaded
	});

Note, that simply using the plugin loader will not load cassius, and trigger parsing of the stylesheet,
so you will not be able to use the extensions, unless you have specifically included
the cassius module as well.

This functionality is implemented and has been well tested.

# Building with AMD Plugin

When used as an AMD plugin, cassius can also integrate with a Dojo build, automatically
including CSS dependencies of modules in a build. To run utilize cassius in a Dojo build,
you need to include the cassius AMD build plugin. This can be specified in your build profile:

	plugins: {
		"cassius/css": "cassius/build/amd-css"
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
		name: "path/to/targetModule.js",
		targetStylesheet: "my-package/css/main-stylesheet.css",
		...

When the build runs, any CSS dependencies that are encountered in modules will then
be added to main-stylesheet.css (which will be created if it does not already exist), rather 
than inlined in the JavaScript build layer. One
can still use the #inline URL directive to inline resources in combination with the AMD
build plugin.
 
# Additional Modules

## has-class

The has-class module provides decoration of the root &lt;html> element with class names
based on feature detection. The has-class module works in conjunction with the has()
module in Dojo (dojo/has) to detect features, and adds a class name for matches with
a "has-" prefix. For example, if we wanted to create a CSS rule that was conditional on the detection of
the "quirks" feature, first we would need to register this feature detection with the has-class module:

	define(['cassius/has-class'], function(hasClass){
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

## License
cassius is freely available under *either* the terms of the modified BSD license *or* the
Academic Free License version 2.1. More details can be found in the [LICENSE](LICENSE).
The cassius project follows the IP guidelines of Dojo foundation packages and all contributions require a Dojo CLA. 
If you feel compelled to make a monetary contribution, consider some of the author's [favorite
charities](http://thezyps.com/2012-giving-guide/) like [Innovations for Poverty Action](http://www.poverty-action.org/) or
the [UNFPA](http://www.friendsofunfpa.org/).
