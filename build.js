if(typeof define == 'undefined'){
	module.exports = require('./cassius/build');
}else{
	define(['./cassius/build'], function(build){
		return build;
	});
}