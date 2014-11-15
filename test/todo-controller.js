define([], function() {
	return {
		focusInput: function(taskElement){
			taskElement.querySelector('.edit').focus();
		}
	};
});