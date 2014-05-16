define([
	'intern!object',
	'intern/chai!assert',
	'xstyle/util/getComputedStyle',
	'xstyle/main',
	'xstyle/main!./base.css',
	'dojo/domReady!'
], function(registerSuite, assert, getComputedStyle, xstyle){
	var put = xstyle.generate;
	registerSuite({
		name: 'base',
		prefix: function(){
			var testElement = put(document.body, 'test-prefix');
			if('WebkitAppearance' in testElement.style){
				assert.strictEqual(getComputedStyle(testElement).WebkitAppearance, 'button');
			}
		},
		expand: function(){
			var testElement = put(document.body, 'test-expand');
			var style = getComputedStyle(testElement);
			assert.strictEqual(style.marginTop, '1px');
			assert.strictEqual(style.marginRight, '2px');
			assert.strictEqual(style.marginBottom, '3px');
			assert.strictEqual(style.marginLeft, '1px');
		}
	});
});