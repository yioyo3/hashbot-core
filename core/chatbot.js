const ANSWERS_FILE = "./answers.txt";
const WORKER_FILE = "./cworker.js";

const fs = require("fs");
const closest = require("closest-str");
const spawn = require("threads").spawn;

let dict = {};

fs.readFileSync(ANSWERS_FILE)
	.toString("utf-8")
	.split("\n")
	.map(function(line) {
		const s = line.split("\\");

		if (dict[s[0]]) dict[s[0]].push(s[1]);
		else dict[s[0]] = [s[1]];
	});

closest.setdict(dict);

console.log("ChatBot initialized");

function query(q, callback) {
	let thread = spawn(WORKER_FILE);
	thread.send({
		dict: closest.__dict,
		query: q
	}).on("message", function(answers) {
		callback(answers[Math.floor(Math.random() * answers.length)]);
		thread.kill();
	});
}

module.exports = {
	query: query,
	dict: closest.__dict
}
