define(['dbind/bind', 'xstyle/util/create-style-sheet', 'xstyle/elemental'], function(bind, createStyleSheet, elemental){
	var model = {data:"test", ui: "#target {\n\t=> div 'Hello World!';\n\tbackground-color: red;\n\twidth: 100px;\n\theight: 100px;\n}"};
	var converter = bind(model);
	converter.get('data', update);
	converter.get('ui', update);
	var parse, lastStyleSheet;
	function update(){
		console.log('model.data, model.ui', model.data, model.ui);
		var newSheet = createStyleSheet(model.ui);
		setTimeout(function(){
			if(lastStyleSheet){
				// remove the last stylesheet
				document.head.removeChild(lastStyleSheet);
				elemental.clearRenderers();
				document.getElementById("target").innerHTML = "";
			}
			lastStyleSheet = newSheet;
			parse(model.ui, lastStyleSheet.sheet);
		},100);
	}
	converter.onProperty = function(name, value, rule){
		do{
			parse = rule.parse;
			rule = rule.parent;
		}while(!parse);
	}	return converter;
});