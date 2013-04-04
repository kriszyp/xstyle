define("xstyle/core/parser", [], function(){
	// regular expressions used to parse CSS
	var cssScan = /\s*((?:[^{\}\[\]\(\)\\'":=;]|\[(?:[^\]'"]|'(?:\\.|[^'])*'|"(?:\\.|[^"])*")\])*)([=:]\??\s*([^{\}\[\]\(\)\\'":;]*))?([{\}\[\]\(\)\\'":;]|$)/g;
									// name: value 	operator
	var singleQuoteScan = /((?:\\.|[^'])*)'/g;
	var doubleQuoteScan = /((?:\\.|[^"])*)"/g;
	var commentScan = /\/\*[\w\W]*?\*\//g; // preserve carriage returns to retain line numbering once we do line based error reporting 
	var operatorMatch = {
		'{': '}',
		'[': ']',
		'(': ')'
	};
	var nextId = 0;
	var trim = ''.trim ? function (str){
		return str.trim();
	} : function(str){
		return str.replace(/^\s+|\s+$/g, '');
	};
	function toStringWithoutCommas(){
		return this.join('');
	}
	function arrayWithoutCommas(array){
		array.toString = toStringWithoutCommas;
		return array;
	}
	function LiteralString(string){
		this.value = string;
	}
	LiteralString.prototype.toString = function(){
		return '"' + this.value.replace(/["\\\n\r]/g, '\\$&') + '"';
	}
	
	function convertCssNameToJs(name){
		return name.replace(/-(\w)/g, function(t, firstLetter){
			return firstLetter.toUpperCase();
		});
	}
	function extend(base, derivative){
		var newText = base.cssText;
		derivative.cssText += newText;
		'values,properties,variables,calls'.replace(/\w+/g, function(property){
			if(base[property]){
				derivative[property] = Object.create(base[property]);
			}
		});
//		var ruleStyle = derivative.getCssRule().style;
		base.eachProperty(function(name, value){
			derivative.setValue(name, value);
	/*		if(name){
				name = convertCssNameToJs(name);
				if(!ruleStyle[name]){
					ruleStyle[name] = value;
				}
			}*/
		});
		if(base.generator){
			derivative.declareProperty(null, base.generator);
		}
		
	}
	
	function parse(model, textToParse, styleSheet){
		// tracks the stack of rules as they get nested
		var stack = [model];
		model.parse = parseSheet;
		parseSheet(textToParse, styleSheet);
		function parseSheet(textToParse, styleSheet){
			// parse the CSS, finding each rule
			function addInSequence(operand, dontAddToSelector){
				if(!dontAddToSelector){
					selector += operand;
				}
				if(sequence){
					// we had a string so we are accumulated sequences now
					sequence.push ?
						typeof sequence[sequence.length - 1] == 'string' && typeof operand == 'string' ?
							sequence[sequence.length - 1] += operand : // just append the string to last segment
							operand && sequence.push(operand) : // add to the sequence
						typeof sequence == 'string' && typeof operand == 'string' ?
							sequence += operand : // keep appending to the string
							sequence = arrayWithoutCommas([sequence, operand]); // start a new sequence array
				}else{
					sequence = operand;
				}
			}
			textToParse = textToParse.replace(commentScan, '');
			target = model; // start at root
			cssScan.lastIndex = 0; // start at zero
			var ruleIndex = 0, browserUnderstoodRule = true, selector = '', assignNextName = true;
			while(true){
				// parse the next block in the CSS
				// we could perhaps use a simplified regex when we are in a property value 
				var match = cssScan.exec(textToParse);
				// the next block is parsed into several parts that comprise some operands and an operator
				var operator = match[4],
					first = match[1],
					assignment = match[2],
					value = match[3],
					assignmentOperator, name, sequence,
					conditionalAssignment;
				value = value && trim(value);
				
				first = trim(first);
				if(assignNextName){
					// we are at the beginning of a new property
					if(assignment){
						// remember the name, so can assign to it
						selector = name = first;
						//	selector = match[1] + assignment;
						// remember the operator (could be ':' for a property assignment or '=' for a property declaration)
						assignmentOperator = assignment.charAt(0);
						conditionalAssignment = assignment.charAt(1) == '?';
					}else{
						selector = value = first;
					}
					// store in the sequence, the sequence can contain values from multiple rounds of parsing
					sequence = value;
					// we have the assigned property name now, and don't need to assign again
					assignNextName = false;
				}else{
					// subsequent part of a property
					value = value ? first + assignment : first;
					// add to the current sequence
					addInSequence(value);	
				}
				switch(operator){
					case "'": case '"':
						// encountered a quoted string, parse through to the end of the string and add to the current sequence
						var quoteScan = operator == "'" ? singleQuoteScan : doubleQuoteScan;
						quoteScan.lastIndex = cssScan.lastIndex; // find our current location in the parsing
						var parsed = quoteScan.exec(textToParse);
						if(!parsed){ // no match for the end of the string
							error("unterminated string");
						}
						var str = parsed[1]; // the contents of the string
						// move the css parser up to the end of the string position
						cssScan.lastIndex = quoteScan.lastIndex; 
						// push the string on the current value and keep parsing
						addInSequence(new LiteralString(str));
						continue;
					case '\\':
						// escaping
						var lastIndex = quoteScan.lastIndex++;
						// add the escaped character to the sequence
						addInSequence(textToParse.charAt(lastIndex));
						continue;
					case '(': case '{': case '[':
						// encountered a new contents of a rule or a function call
						var newTarget;
						var doExtend = false;
						if(operator == '{'){
							// it's a rule
							assignNextName = true; // enter into the beginning of property mode
							// normalize the selector
							selector = trim(selector.replace(/\s+/g, ' ').replace(/([\.#:])\S+|\w+/g,function(t, operator){
								// make tag names be lower case 
								return operator ? t : t.toLowerCase();
							}));	
							// add this new rule to the current parent rule
							addInSequence(newTarget = target.newRule(selector), true);
							
							// todo: check the type
							if(assignmentOperator == '='){
								browserUnderstoodRule = false;
								if(!assignment || assignment.charAt(1) == '>'){
									sequence.creating = true;
								}
								if(value){
									// extend the referenced target value
									// TODO: create auto-generate class?
									doExtend = true;
								}
							}
							if(target.root && browserUnderstoodRule){
								// we track the native CSSOM rule that we are attached to so we can add properties to the correct rule
								var lastRuleIndex = ruleIndex;
								var nextRule;
								while((nextRule = styleSheet.cssRules[ruleIndex++])){									
									if(nextRule.selectorText == selector){
										// found it
										newTarget.cssRule = nextRule;
										break;
									}
								}
								if(!nextRule){
									// didn't find it
									newTarget.ruleIndex = ruleIndex = lastRuleIndex;
									newTarget.styleSheet = styleSheet;									
									//console.warn("Unable to find rule ", selector, "existing rule did not match", nextRule.selectorText); 
								}
							}
						}else{
							// it's a call, add it in the current sequence
							var callParts = value.match(/(.*?)([\w-]*)$/);
							addInSequence(newTarget = target.newCall(callParts[2], sequence, target));
							newTarget.ref = model.resolveProperty(target, callParts[2]);
							(sequence.calls || (sequence.calls = [])).push(newTarget);
						}
						// make the parent reference
						newTarget.parent = target;
						if(sequence.creating){
							// in generation, we auto-generate selectors so we can reference them
							newTarget.selector = '.x-generated-' + nextId++;
						}else{							
							newTarget.selector = target.root ? selector : target.selector + ' ' + selector;
						}
						if(doExtend){
							var ref = model.resolveProperty(target, value.match(/[^\s]+$/)[0], true);
							if(ref){
								extend(ref, newTarget);
							}
						}
						
						// store the current state information so we can restore it when exiting this rule or call
						target.currentName = name;
						target.currentSequence = sequence;
						target.assignmentOperator = assignmentOperator;
						// if it has a pseudo, call the pseudo handler
						if(assignmentOperator == ':'){
							// TODO: use when()
							var pseudoHandler = model.resolveProperty(target, value);
							if(pseudoHandler && pseudoHandler.pseudo){
								pseudoHandler.pseudo(target, value);
							}
						}

						// add to the stack
						stack.push(target = newTarget);
						target.operator = operator;
						target.start = cssScan.lastIndex;
						selector = '';
						name = null;
						sequence = null;
						continue;
				}
				if(sequence){
					// now see if we need to process an assignment or directive
					var first = sequence[0];
					if(first.charAt && first.charAt(0) == "@"){
						// it's a directive
						if(sequence[0].slice(1,7) == "import"){
							// get the stylesheet
							var importedSheet = parse.getStyleSheet(styleSheet.cssRules[ruleIndex++], sequence, styleSheet);
							//waiting++;
							// preserve the current index, as we are using a single regex to be shared by all parsing executions
							var currentIndex = cssScan.lastIndex;
							// parse the imported stylesheet
							parseSheet(importedSheet.localSource, importedSheet);
							// now restore our state
							cssScan.lastIndex = currentIndex;
						}
					}else if(assignmentOperator){
						// need to do an assignment
						try{
							target[assignmentOperator == ':' ? 'setValue' : 'declareProperty'](name, sequence, conditionalAssignment);
						}catch(e){
							console.error("Error on line ", textToParse.slice(0, cssScan.lastIndex).split('\n').length, "in", styleSheet.href, e.stack || e);
						}
					}
				}
				switch(operator){
					case ':':
						// assignment can happen after a property declaration
						if(assignmentOperator == '='){
							assignNextName = true;
							assignmentOperator = ':';
						}else{
							// a double pseudo
							addInSequence(':');
						}
						break;
					case '}': case ')': case ']':
						// end of a rule or function call
						// clear the name now
						if(operatorMatch[target.operator] != operator){
							console.error('Incorrect opening operator ' + target.operator + ' with closing operator ' + operator); 
						}
						name = null;
						// record the cssText
						var ruleCssText = textToParse.slice(target.start, cssScan.lastIndex - 1);
						target.cssText = target.cssText ? 
							target.cssText + ';' + ruleCssText : ruleCssText;
							
						if(operator == '}'){
							// if it is rule, call the rule handler 
							target.onRule(target.selector, target);
							// TODO: remove this conditional, now that we use assignment
							/*if(target.selector.slice(0,2) != "x-"){// don't trigger the property for the property registration
								target.eachProperty(onProperty);
							}*/
							browserUnderstoodRule = true;
							selector = '';
						}/*else if(operator == ')'){
							// call handler
							onCall(target.caller, target);
						}*/
						// now pop the call or rule off the stack and restore the state
						stack.pop();
						target = stack[stack.length - 1];				
						sequence = target.currentSequence;
						name = target.currentName;
						assignmentOperator = target.assignmentOperator;
						if(target.root && operator == '}'){
							// CSS ASI
							assignNextName = true;
							assignmentOperator = false;
						}
						break;
					case "":
						// no operator means we have reached the end of the text to parse
						return;
					case ';':
						// end of a property, end the sequence return to the beginning of propery mode
						sequence = null;
						assignNextName = true;
						browserUnderstoodRule = false;
						assignmentOperator = false;
						selector = '';
				}
			}
		}
	}
	return parse;
});