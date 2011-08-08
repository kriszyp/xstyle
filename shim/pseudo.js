define("xstyle/shim/pseudo",[], function(){
	var attachedEvents = {};
	function handleEvent(eventType, add){
		if(!attachedEvents[eventType]){
			attachedEvents[eventType] = true;
			document.attachEvent(eventType, function(event){
				var element = event.srcElement;
				if(element.currentStyle.xstyleHover){
					if(add){
						element.className += " xstyle-hover";
					}else{
						element.className = (' ' + element.className + ' ').replace(' xstyle-hover ', ' ').slice(1);
					}
				}
			});
		}
	}
	return {
		onPseudo: function(name, rule){
			if(name == "hover"){
				handleEvent("onmouseover", true);
				handleEvent("onmouseout", false);
				rule.add(rule.selector.replace(/:hover/, ''), 'xstyle-hover: true');
				rule.add(rule.selector.replace(/:hover/, '.xstyle-hover'), rule.cssText);
			}else if(name == "focus"){
				handleEvent("onactivate", true);
				handleEvent("ondeactivate", false);
				rule.add(rule.selector.replace(/:hover/, ''), 'xstyle-focus: true');
				rule.add(rule.selector.replace(/:hover/, '.xstyle-focus'), rule.cssText);
			}
		}
	};
});
