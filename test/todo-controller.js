define(['./todo-model', 'dojo/router'], function(model, router) {
	router.register('/:view', function(event){
		var view = event.params.view || 'all';
		model.tasksView = model[view];
	});
	router.startup();
	return {
		focusInput: function(taskElement){
			taskElement.querySelector('.edit').focus();
		}
	};
});