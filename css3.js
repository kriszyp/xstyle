define([], function(){
	var extensions = {};
	function vendorize(name){
		extensions[name] = function(value, property){
			return name + ":" + value + ";-moz-" + name + ":" + value;
		}
	}
	vendorize("box-shadow");
	vendorize("border-radius");
	return extensions;
})