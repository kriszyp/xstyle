define([], function(){
	function ElementContext(element, rule){
		this.element = element;
		this.rule = rule;
	}
	function Cache(definition){
		this.definition = definition;
		definition._elementCache = this;
	} 
	Cache.prototype = {
		elementsForDependent: function(context){
			var element = context && context.getElement() || document.body;
			var elements = element.getElementsByClassName(this.definition.id);
			if((' ' + element.className + ' ').indexOf(this.definition.id) > -1){
				// this element matches as well, add the others to an array of this element
				var thisElements = [element];
				if(elements.length){
					return thisElements.push.apply(thisElements, elements);
				}
				return thisElements;
			}
			return elements;
		},
		clear: function(){
			var elements = this.elementsForDependent(this.definition);
			for(var i = 0, l = elements.length; i < l; i++){
				delete elements[i]['cached-' + this.definition.id];
			}
			delete this.cached;
		},
		get: function(context){
			if(context.pivotalElement){
				// determine if this definition is on the cache of any elements
				var cachedProperty = 'cached-' + this.definition.id;
				var element = context.getElement(function(element){
					do{
						if(element[cachedProperty]){
							return element;
						}
					}while((element = element.parentNode) && element);
				});
				return element[cachedProperty];
			}
			// TODO:else rule
		},
		put: function(context, value){

		}

	}
	ElementContext.prototype = {
		track: function(dependent){
			var tracked = Object.create(this);
			tracked.dependent = dependent;
			return tracked;
		},
		rulesForDependent: function(rule){

		},
		getElement: function(determinePivotal){
			var element = this.context.element;
			//TODO: if this a parent of pivotalElement, leave pivotalElement alone,
			// otherwise replace pivotalElement with this
			this.pivotalElement = (determinePivotal ? determinePivotal(element) : element) ||
				this.pivotalElement;
			return this.pivotalElement;
		},
		getRule: function(){

		},
		getCache: function(definition){
			return definition._elementCache || new Cache(definition);
		}
	};
	return ElementContext;
});