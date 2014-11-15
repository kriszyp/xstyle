define(['dstore/Memory', 'dstore/Trackable'], function(Memory, Trackable){
	tasks = new (Memory.createSubclass(Trackable))({data:[
		{id:'one', title:'One'},
		{id:'two', title:'Two'},
		{id:'three', title:'Three'}
	]});
	var model = {
		tasks: tasks,
		newItem: '',
		addItem: function(event){
			event.preventDefault();// don't submit the form
			console.log('add item', model.newItem);
			tasks.add({title: model.newItem});
			model.newItem = '';
		},
		'total-todo':3
	};
	return model;
});