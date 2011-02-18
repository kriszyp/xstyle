XStyle is a extensible CSS loader designed to support various plugins for additional 
CSS functionality and backwards compatibility of newer features.

A simple example of using xstyle to load CSS:
<pre>
<script src="/path/to/xstyle/xstyle.js"></script>
<script>
xStyle.load("./xstyle!./path/to/example.css").then(function(){
	// all loaded
});
</script>
</pre>
Or you can use xstyle as a CSS loader plugin for AMD loaders like RequireJS:
<pre>
define(["xstyle!./path/to/example.css"], function(){
	// module starts after css is loaded
});
</pre>

XStyle is designed to allow for plugins to be registered to handle different CSS properties.
For example, we could use the CSS3 plugin to enable the box-shadow property to
work on browsers that use vendor prefixes:
<pre>
example.css:
#table {
	box-shadow: 2px 5px 5px black;
}
html:
<script src="/path/to/xstyle/xstyle.js"></script>
<script src="/path/to/xstyle/css3.js"></script>
<script>
xStyle.load("./xstyle!./path/to/example.css").extend(xStyle.CSS3);
</script>
Or with a module loader:
define(["xstyle!./path/to/example.css", "xstyle/css3"], function(exampleStyle, CSS3){
	exampleStyle.extend(CSS3);
});
</pre>

We can also extend with widget support for auto-loading of widgets:

<pre>
example.css:
#table {
	widget: require('list/Table');
	height: 300px;
	width: 400px;
	box-shadow: 2px 5px 5px black;
}

module.js:
define(["xstyle!./path/to/example.css", "style/widget", "style/css3"], function(style, widget, css3){
	style.extend(widget, css3); 
});
</pre>

We can also generate layout from CSS:
<pre>
example.css:
#header {
	background-color: #eee;
	h1#headline {
		color: red;
	};
}

#footer {
	color: blue;
	.made-by {
		content: 'Kris Zyp'
	}
}
module.js:
define(["xstyle!./path/to/example.css", "style/layout"], function(style, layout){
	style.extend(layout); 
});
</pre>
This will find the #header element and #footer element and proactively generate the internal h1#headline (&lt;h1 id="headline">&lt;/h1>) and .made-by (&lt;div class="made-by">&lt;/div>) elements.
We could even have it generate the top level #header and #footer for us:
<pre>
define(["xstyle!./path/to/example.css", "style/layout"], function(style, layout){
	style.extend(layout).render(document.body);
});
</pre>
 