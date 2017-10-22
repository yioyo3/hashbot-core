process.on("uncaughtException", function(e) {
	console.log("[ERROR] " + e);
});

var Message = require("./message.js");
var Command = require("./command.js");
var https = require("https");
var Image = require("image-binary");

var Core = function(options) {
	console.log("Initializing core...");

	this.VK = require("VK-Promise")
	this.vk = new this.VK(options.access_token);
	this.commands = [];
	this.ignore = [];
	this.admin_id = options.admin_id;
	this.admin_only = options.admin_only;
	this.mentions = options.mentions;
	this.mps = {};
	client = require("rucaptcha-client").create(options.rucaptcha_key);

	var self = this;

	this.addCommand = function(variations, description, admin_only, callback) {
		self.commands.push(new Command(variations, description, admin_only, callback));
	};

	console.log("Core configuration initialized");

	this.vk.init_longpoll();

	console.log("LongPoll initialized (hopefully)");

	setInterval(function() {
		self.mps = {};
	}, 1000);

	this.vk.on("message", function(event, plain_message) {
		var message = new Message(plain_message);

		if (message.out) return;

		if (self.admin_only && message.from_id != self.admin_id) return;

		if (self.ignore.indexOf(message.from_id) > -1) return;

		if ((self.mentions.indexOf(message.mention.toLowerCase() + ",") == -1) && (self.mentions.indexOf(message.mention.toLowerCase()) == -1)) return;

		self.mps[message.from_id] = (self.mps[message.from_id] || 0) + 1;

		if (self.mps[message.from_id] > 4) {
			message.reply("Вы были забанены за флуд, а ибо нефиг.", {attachment: "video71358147_456239101"});
			return self.ignore.push(message.from_id);
		}

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

	this.vk.on("captcha", function(event, data) {
		let balance;
		client.balance
		.then((num) => {
			balance = num;
			return Image.create(data.captcha_img);
		})
		.then((image) => {
			client.image = image;
			return client.solve({});
		})
		.then((answer) => {
			console.log(
				'====== Captcha Solver ======' + '\n' +
				'Balance: ' + balance + '\n' +
				'Answer: ' + answer.text + '\n' +
				'============================'
			);
			data.submit(answer.text);
		});
	});

	console.log("Core initialized, awaiting commands");
};

module.exports = Core;