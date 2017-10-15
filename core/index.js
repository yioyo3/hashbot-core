process.on("uncaughtException", function(e) {
	console.log("[ERROR] " + e);
});

var Message = require("./message.js");
var Command = require("./command.js");

var Core = function(options) {
	console.log("Initializing core...");

	this.vk = require("VK-Promise")(options.access_token);
	this.commands = [];
	this.ignore = [];
	this.admin_id = options.admin_id;
	this.admin_only = options.admin_only;
	this.mentions = options.mentions;

	var self = this;

	this.addCommand = function(variations, description, admin_only, callback) {
		self.commands.push(new Command(variations, description, admin_only, callback));
	};

	console.log("Core configuration initialized");

	this.vk.init_longpoll();

	console.log("LongPoll initialized (hopefully)");

	this.vk.on("message", function(event, plain_message) {
		var message = new Message(plain_message);

		if (message.admin_only && message.from_id != self.admin_id) return;

		if (self.ignore.indexOf(message.from_id) > -1) return;

		if (self.mentions.indexOf(message.mention.toLowerCase()) == -1) return;

		if (self.mentions.indexOf(message.mention.toLowerCase() + ",") == -1) return; // too lazy to add commas to mentions

		var command = self.commands.find(function (cmd) {
			return cmd.variations.indexOf(message.cmd.toLowerCase()) > -1;
		});

		if (!command) return;

		if (command.admin_only && message.from_id != self.admin_id) return message.reply("У вас нет прав администратора!");

		console.log(`${message.from_id}/${message.chat_id || 0}: ${message.body}`);

		try {
			command.callback(message);
		} catch(e) {
			console.log(e.stack);
		}
	});
	console.log("Core initialized, awaiting commands");
};

module.exports = Core;