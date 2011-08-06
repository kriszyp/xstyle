/*
    Handles transitions and animations
*/
define(["./vendorize", "../elemental"],function(vendor, elemental){
	var transitions = [];
	function propertyChange(event){
		var element = event.srcElement;
		var elementTransitions = element._transitions;
		var previousStyle = element._previousStyle;
		var runtimeStyle = element.runtimeStyle;
		var currentStyle = element.currentStyle;
		for(var i in previousStyle){
			var runtime = runtimeStyle[i];
			delete runtimeStyle[i];
			var previous = previousStyle[i];
			var current = currentStyle[i];
			if(previous != current){
				previous = parseUnits(previous);
				runtime = parseUnits(runtime);
				current = parseUnits(current);
				var toGo = distance(current, runtime);
				var total = distance(current, previous);
				var transition = elementTransitions[i];
				if(transition){
					transition.at = 1;
				}
				transition = elementTransitions[i] = {
					from: runtime,
					element: element,
					to: current,
					duration: element._transitionDuration * toGo / total,
					timing: timing[element._transitionTiming || "ease"], 
					property: i,
					t: 0 
				};
				transitions.push(transition);
				previousStyle[i] = current;
			}
			runtimeStyle[i] = runtime;
		}
		
	}
	var rgb = /^rgba?\(([0-9,]+)\)/i;
	var hex = /#([0-9a-f]+)/i;
	var units = /([-0-9\.]+)([\w]+)/;
	function parseUnits(value){
		var match = value.match(rgb);
		if(match){
			var parts = match[1].split(",");
			for(var i = 0; i < 4; i++){
				parts[0] = +(parts[0] || 0);
			}
		}else if(match = value.match(hex)){
			match = match[1];
			var parts = [];
			var shortHex = match.length == 3;
			parts[0] = parseInt(match[0] + match[shortHex ? 0 : 1], 16);
			parts[1] = parseInt(match[shortHex ? 1 : 2] + match[shortHex ? 1 : 3], 16);
			parts[2] = parseInt(match[shortHex ? 2 : 4] + match[shortHex ? 2 : 5], 16);
//			parts[3] = parseInt(match[6] ? match[6] + match[7] : 0);
			parts.units = "rgb";
			return parts;
		}else if(match = value.match(units)){
			parts = [match[1]];
			parts.units = match[2];
			return parts;
		}else{
			return [];
		}
		parts.units = "rgb";
		return parts;
	}
	function distance(start, end){
		var sum = 0;
		for(var i = 0; i < start.length; i++){
			sum += Math.abs(end[i] - start[i]);
		}
		return sum;
	}
	function ratio(start, end, completed){
		var mid = [];
		for(var i = 0; i < start.length; i++){
			mid[i] = end[i] * completed - start[i] * (1 - completed);
		}
		if(start.units == "rgb"){
			return "#" + mid[0].toString(16)+mid[1].toString(16)+mid[2].toString(16)+mid[3].toString(16);
		}else{
			return mid[0] + start.units; 
		}
	}
	var transitions = [];
	var currentTime = new Date().getTime();
	var period = 30;
	setInterval(function(){
		var lastTime = currentTime;
		currentTime = new Date().getTime();
		for(var i = 0, l = transitions.length; i < l; i++){
			var transition = transitions[i];
			runtimeStyle = element.runtimeStyle;
			var t = transition.t += period / 1000 / transition.duration;
			//runtimeStyle[transition.property] = ratio(transition.timing(transition.from, transition.end, transition.t));
		}
	}, period);
	// these are based on the cubic-bezier functions described by https://developer.mozilla.org/en/CSS/transition-timing-function
	var timing = {
		ease: cubic(0.25, 0.1, 0.25, 1),
		linear: cubic(0, 0, 1, 1),
		"ease-in": cubic(0.42, 0, 1, 1),
		"ease-out": cubic(0, 0, 0.58, 1),
		"ease-in-out": cubic(0.42, 0, 0.58, 1)
	};
	function cubic(x0, y0, x1, y1){
		// this is not a true 2-D cubic bezier, but a reasonable approximation
		var p1 = ((y0 + 0.01) / (x0 + 0.01)) / 3;
		var p2 = 1 - ((1.01 - y1) / (1.01 - x1)) / 3;
		return function(t){
			return 3*(1-t)*(1-t)*t*p1 + 3*(1-t)*t*t*p2 + t*t*t;
		}
	}
	function easing(t){
		var v = ((x0 - Math.sqrt(x0*x0 + t*(x1-2*x0)))/(2*x0-x1) * 2 / 3 * (1-t) * (1-t) +
			((x1-x0 - Math.sqrt((x1-x0)*(x1-x0) + (t-x0)*((1-x0)-2*(x1-x0)))) / (2*(x1-x0)-1+x0) * 2 / 3 + 1/3) * t *t) / ((1-t) * (1-t) + t * t);
		var v = (x0-x1 + Math.sqrt((x1-x0)*(x1-x0) - (1+x0-t)*(x0-2*x1)))/(1+x0-t);
		
		return t*t*(1-t)+(1-(1-t)*(1-t))*t;
	}
	return {
		onProperty: function(name, value, rule){
			if(vendor.prefix == "-ms-"){
				return elemental.addRenderer(rule.selector, function(element){
					var currentStyle = element.currentStyle;
					var previousStyle = element._previousStyle = {};
					if(name == "transition-duration"){
						element._transitionDuration = parseFloat(value);
					}
					for(var i in currentStyle){
						previousStyle[i] = currentStyle[i];
					}
					element.attachEvent("onpropertychange", propertyChange);
				});
			}
			return vendor.onProperty(name, value);
		}
	};
});

