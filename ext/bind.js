define(['dbind/bind', 'xstyle/elemental'], function(bind, elemental){
	return module = {
		onProperty: function(name, value, rule){
			if(name == 'bind'){
				rule.then = function(callback){
						require(value[1].args, function(module){
							callback(bind(module));
						});
					};
			}else{
				var target, variables = [], id = 0, variableLength = 0, waiting = 1;
				function done(){
					if(--waiting == 0){
						if(expression.length > variableLength){
							target = bind(new Function('return ' + expression)).to(variables);
						}else{
							target = variables[0];
						}
						elemental.addRenderer(name, value, rule, function(element){
							bind(element).to(target);
						});
					}
				}
				// find all the variables in the expression
				var expression = value.replace(/[\w_\.]+/g, function(variable){
					var position = id++;
					var parts = variable.split('.');
					var ruleParent = rule;
					while(!target && (ruleParent = ruleParent.parent)){
						// find the first target referenced
						target = ruleParent.rules[parts[0]];
					}
					if(!target){
						target = window[parts[0]];
					}
					waiting++;
					// TODO: use when
					target.then(function(target){
						for(var i = 1; i < parts.length; i++){
							target = target.get(parts[i]);
						}
						variables[position] = target;
						done();
					});
					var replacement = 'arguments[' + position + ']';
					variableLength += replacement.length;
					return replacement;
				});
				done();
			}
		}
	};
});