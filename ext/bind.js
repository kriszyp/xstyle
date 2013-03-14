define(['xstyle/xstyle'], function(xstyle){
	return module = {
		onProperty: function(name, value, rule){
			if(name == 'bind'){
				// TODO: integrate this so we don't need a different propery name.
				rule.then = function(callback){
						require(value[1].args, function(module){
							callback(bind(module));
						});
					};
			}else{
				var target, variables = [], id = 0, variableLength = 0, waiting = 1, callbacks = [],
					parameterized = false;
				var expression = [];
				var parts = value.sort ? value : [value];
				// Do the parsing and function creation just once, and adapt the dependencies for the element at creation time
				// deal with an array, converting strings to JS-eval'able strings
				for(var i = 0;i < parts.length;i++){
					var part = parts[i];
					expression.push(part instanceof String ? addString(part) : 
						// find all the variables in the expression
						part.replace(/[a-zA-Z_$][\w_$\.]*/g, function(variable){
							var position = id++;
							// for each reference, we break apart into variable reference and property references after each dot
							var parts = variable.split('.');
							variables.push(parts);
							var ruleParent = rule;
							while(!target && (ruleParent = ruleParent.parent)){
								// find the first target referenced
								target = ruleParent.rules[parts[0]];
							}
							if(!target){
								target = window[parts[0]];
							}
							if(!target){
								target = "not found";
							}
							waiting++;
							// wait for each reference
							bind.when(target, function(target){
								for(var i = 1; i < parts.length; i++){
									target = target.get(parts[i]);
								}
								variables[position] = target;
								done();
							});
							return addArgument(position);
							// we will reference the variable a function argument in the function we will create
						})
					);
				}
				expression = expression.join('');
				function addString(part){
					var position = id++;
					variables[position] = part;
					return addArgument(position);
				}
				function addArgument(position){
					var replacement = 'arguments[' + position + ']';
					variableLength += replacement.length;
					return replacement;
				}
				if(expression.length > variableLength){
					// it's a full expression, so we create a time-varying bound function with the expression
					var reactiveFunction = new Function('return ' + expression);
				}

				// create a then function for chaining
				rule.then = function(callback){
					if(callbacks){
						callbacks.push(callback);
					}else{
						callback(target);
					}
					if(target){
						return;
					}
					
					function done(){
						if(--waiting == 0){
							if(expression.length > variableLength){
								// it's a full expression, so we create a time-varying bound function with the expression
								var reactiveFunction = bind(new Function('return ' + expression));
								if(parameterized){
									target = {
										call: function(item){
											// TODO: find the iipaarmeterized/item variables and replace them
											target = reactiveFunction.to(variables);
										}
									}
								}else{
									target = reactiveFunction.to(variables);
								}
							}else{
								target = variables[0];
							}
							// and we render any matches
							for(var i = 0;i < callbacks.length; i++){
								callbacks[i](target);
							}
							callbacks = null;
						}
					}
					done();
					
				};
				xstyle.addRenderer(name, value, rule, function(element){
					var elementBinding = bind(element), waiting = variables.length;					
					for(var i = 0; i < variables.length; i++){
						var elementAncestor = element;
						var parts = variables[i];
						do{
							var value = elementAncestor[parts[0]];
						}while(!value && (elementAncestor != window) && 
								(elementAncestor = elementAncestor.parentNode || window));
						// wait for each reference
						bind.when(target, function(target){
							for(var i = 1; i < parts.length; i++){
								target = target.get(parts[i]);
							}
							variables[position] = target;
							done();
						});
					}

					reactiveFunction
					var each = rule.get("eachFunction");
					if(each){
						elementBinding.each = function(item){
							try{
								var itemElement = each(element, item);
								itemElement.xItem = item;
								return itemElement;
							}catch(e){
								// TODO: use put-selector?
								console.error(e);
								element.appendChild(document.createElement('span')).appendChild(document.createTextNode(e));
							}
						}
					}
					// TODO: move this to dbind/bind (so it can accept promises for a reactive object
					bind.when(target, function(target){
						elementBinding.to(target);
					});
				});
			}
		}
	};
});