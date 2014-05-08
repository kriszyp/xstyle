define([
	'intern!object',
	'intern/chai!assert',
	'xstyle/core/expression',
	'xstyle/core/base',
	'dstore/Model'
], function(registerSuite, assert, expression, base, Model){
	var rule;
	registerSuite({
		name: 'core',
		beforeEach: function(){
			rule = base.newRule();
			rule.parent = base;
		},
		evaluate: function(){
			var obj = new Model();
			var a = obj.property('a');
			a.put(3);
			rule.declareDefinition('a', a);
			var b = obj.property('b');
			b.put(4);
			rule.declareDefinition('b', b);
			var aPlusB = expression.evaluate(rule, 'a+b');
			assert.equal(aPlusB.valueOf(), 7);
			var latestSum;
			aPlusB.observe(function(value){
				latestSum = value;
			});
			assert.equal(latestSum, 7);
			b.put(5);
			assert.equal(latestSum, 8);
			var latestA;
			a.observe(function(value){
				latestA = value;
			});
			aPlusB.put(9);
			assert.equal(latestA, 4);
		}
	});
});