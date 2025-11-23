import $ from "dax-sh";

let name;
name = await $.prompt("What's your name?");

$.log(name)

// or provide an object, which has some more options
name = await $.prompt({
    message: "What's your name?",
    default: "Dax", // prefilled value
    noClear: true, // don't clear the text on result
});
$.log(name)

// or hybrid
name = await $.prompt("What's your name?", {
    default: "Dax",
});

$.log(name)

// with a character mask (for password / secret input)
const password = await $.prompt("What's your password?", {
    mask: true,
});