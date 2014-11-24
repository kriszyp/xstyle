define(['dstore/Memory', 'dstore/Trackable'], function(Memory, Trackable){
	tasks = new (Memory.createSubclass(Trackable))({data:[
		{id:'one', title:'One', completed: false},
		{id:'two', title:'Two', completed: false},
		{id:'three', title:'Three', completed: false}
	]});
	var activeTasks = tasks.filter({completed: false});
	var completedTasks = tasks.filter({completed: true});
	var model = {
		tasks: tasks,
		tasksView: tasks,
		all: tasks,
		completed: completedTasks,
		active: activeTasks,
		newItem: '',
		addItem: function(event){
			event.preventDefault();// don't submit the form
			console.log('add item', model.newItem);
			tasks.add({title: model.newItem, completed: false});
			model.newItem = '';
		},
		destroy: function(item){
			tasks.remove(item.id);
		},
		totalTodo: 3
	};
	tasks.on('add,update,delete', function(event){
		activeTasks.fetch().totalLength.then(function(totalLength){
			model.totalTodo = totalLength;	
		});
	});
	return model;
});