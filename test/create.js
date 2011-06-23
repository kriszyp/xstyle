var div = create("div");
console.assert(div.tagName.toLowerCase() == "div");

var body = document.body;
create(body, "h1", "Running create() tests");

var parent = div;

var span1 = create(parent, "span.class-name-1.class-name-2[name=span1]");
console.assert(span1.className == "class-name-1 class-name-2");
console.assert(span1.getAttribute("name") == "span1");
console.assert(span1.parentNode == div);

var defaultTag = create(parent, ".class");
console.assert(defaultTag.tagName.toLowerCase() == "div");
var span3 = create(span1, "+span[name=span2] + span[name=span3]");
console.assert(span3.getAttribute("name") == "span3");
console.assert(span3.previousSibling.getAttribute("name") == "span2");
console.assert(span3.previousSibling.previousSibling.getAttribute("name") == "span1");

var span0 = create(span1, "-span[name=span0]");
console.assert(span0.getAttribute("name") == "span0");

var spanWithId = create(parent, "span#with-id");
console.assert(spanWithId.id == "with-id");

var table = create(parent, "table.class-name#id tr.class-name td[colSpan=2]<<tr.class-name td+td<<");
console.assert(table.tagName.toLowerCase() == "table");
console.assert(table.childNodes.length == 2);
console.assert(table.firstChild.className == "class-name");
console.assert(table.firstChild.childNodes.length == 1);
console.assert(table.lastChild.className == "class-name");
console.assert(table.lastChild.childNodes.length == 2);

create(table, "tr>td,tr>td+td");
console.assert(table.childNodes.length == 4);
console.assert(table.lastChild.childNodes.length == 2);

var checkbox = create(div, "input[type=checkbox][checked]");
console.assert(checkbox.type == "checkbox");
console.assert(checkbox.getAttribute("checked") == "checked");

create(body, "div", {innerHTML: "finished tests, check console for errors"});