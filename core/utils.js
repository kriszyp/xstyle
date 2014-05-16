define('xstyle/core/utils', [], function(){
	// some utility functions
	var supportedTags = {};
	return {
		when: function(value, callback){
			return value && value.then ?
				(value.then(callback) || value) : callback(value);
		},
		convertCssNameToJs: function(name){
			// TODO: put this in a util module since it is duplicated in parser.js
			return name.replace(/-(\w)/g, function(t, firstLetter){
				return firstLetter.toUpperCase();
			});
		},
		isTagSupported: function(tag){
			// test to see if a tag is supported by the browser
			var element;
			if(tag in supportedTags){
				return supportedTags[tag];
			}
			var elementString = (element = document.createElement(tag)).toString();
			return supportedTags[tag] = !(elementString == '[object HTMLUnknownElement]' ||
				elementString == '[object]');
		},
		extend: function(target, base, error){
			// takes the target and applies to the base, resolving the base
			// TODO: we may want to support full evaluation of the base,
			// at least if it is in paranthesis (to continue to support
			// unambiguous handling of class names), and attribute definitions
			// like range = input[type=range] {};
			var parts = base.split('.');
			base = parts[0];
			var ref = target.getDefinition(base, 'rules');
			// any subsequent parts after the dot are treated as class names
			parts[0] = '';
			target.selector += (target.extraSelector = parts.join('.'));
			if(ref){
				return this.when(ref, function(ref){
					if(ref.extend){
						ref.extend(target, true);
					}else{
						for(var i in ref){
							target[i] = ref[i];
						}
					}
				});
			}else{
				// extending a native element
				target.tagName = base;
				if(!this.isTagSupported(base)){
					error('Extending undefined definition ' + base);
				}
			}
			
		}
	};
});