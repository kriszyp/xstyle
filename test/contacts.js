define(['dojo/store/Memory', 'dojo/store/Observable', 'dbind/bind'], function(Memory, Observable, bind){
	contactStore = new Observable(new Memory({data:[
		{id:1, firstName: "Kris", lastName:"Zyp", email:"kris@sitepen.com"},
		{id:2, firstName: "Bryan", lastName:"Forbes", email:"bryan@sitepen.com"}		
	]}));
	contacts = bind({});
	contacts.set('list', contactStore.query({}));
	contacts.set('select', function(item){
		contacts.set('selected', item);
	});
	contacts.set('selected', {
		firstName:"First",
		lastName:"Last"
	});
	contacts.set('save', function(selected){
		contactStore.put(selected);
	});
	contacts.set('create', function(selected){
		contacts.set('selected', {firstName:"First", lastName: "Last", email: ""});
	});
	return contacts;
});