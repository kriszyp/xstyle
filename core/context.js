define([], function(){
	function ElementContext(element, rule){
		this.element = element;
		this.rule = rule;
	}
	function Cache(definition){
		this.definition = definition;
		definition._cache = this;
	} 
	Cache.prototype = {
		elementsForDependent: function(context){
			var element = context && context.getElement() || document.body;
			var elements = element.getElementsByClassName(this.definition.id);
			// TODO: use a WeakMap for this
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
		clear: function(context){
			var elements = this.elementsForDependent(context);
			for(var i = 0, l = elements.length; i < l; i++){
				delete elements[i]['cached-' + this.definition.id];
			}
			if(!context){
				delete this.cached;
			}
		},
		get: function(name, context){
			var element = context && context.getElement();
			if(element){
				// determine if this definition is on the cache of any elements
				var cachedProperty = 'cached-' + this.definition.id;
				var element = context.getElement(function(element){
					do{
						if(element[cachedProperty]){
							return element;
						}
					}while((element = element.parentNode) && element);
				});
				var cacheObject = element[cachedProperty];
				return cacheObject && cacheObject[name];
			}else{
				// no context
				return this.cached && this.cached[name];
			}
			// TODO:else rule
		},
		set: function(name, value, trackedContext){
			var element;
			if(trackedContext){
				var cachedProperty = 'cached-' + this.definition.id;
				element = trackedContext.pivotalElement;
			}
			if(element){
				(element[cachedProperty] || (element[cachedProperty] = {}))[name] = value;
			}else{
				// no context
				(this.cached || (this.cached = {}))[name] = value;
				//TODO:else rule
			}
		}

	};
	ElementContext.prototype = {
		track: function(){
			return new TrackedContext(this);

		},
		getElement: function(determinePivotal){
			var element = this.element;
			return determinePivotal ? determinePivotal(element) : element;
		},
		getRule: function(){
			return this.rule;
		},
		getCache: function(definition/*, existingCache*/){
			// TODO: eventually we should be able to add to an existing cache, but since we
			// are only ever using this element Context in xstyle, we won't worry about it for now.
			return definition._cache || new Cache(definition);
		}
	};
	function TrackedContext(tracking){
		this.tracking = tracking;
	}
	TrackedContext.prototype = new ElementContext();
	TrackedContext.prototype.getElement = function(determinePivotal){
		var element = this.tracking.getElement(determinePivotal);
		//TODO: if this a parent of pivotalElement, leave pivotalElement alone,
		// otherwise replace pivotalElement with this
		this.pivotalElement = element;
		return element;
	};
	return ElementContext;
});