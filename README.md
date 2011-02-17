define(["xstyle!./path/to/example.css"], function(){
	// module starts after css is loaded
});


We extend with widget support for auto-loading of widgets. We also extend with CSS3
support for doing backwards compatibility for CSS3 properties:

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
This will find the #header element and #footer element and proactively generate the internal h1#headline (<h1 id="headline"></h1>) and .made-by (<div class="made-by"></div>) elements.
We could even have it generate the top level #header and #footer for us:
<pre>
define(["xstyle!./path/to/example.css", "style/layout"], function(style, layout){
	style.extend(layout).render(document.body);
});
</pre>
 