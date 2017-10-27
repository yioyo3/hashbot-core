process.on("uncaughtException", function(e) {
	console.log("[ERROR] " + e);
});

var Message = require("./message.js");
var Command = require("./command.js");
var https = require("https");
var Image = require("image-binary");

var Core = function(options) {
	console.log("Initializing core...");

	this.VK = require("VK-Promise");
	this.vk = new this.VK(options.access_token);
	this.commands = [];
	this.ignore = [];
	this.admin_id = options.admin_id;
	this.admin_only = options.admin_only;
	this.mentions = options.mentions;
	this.mps = {};
	this.chatBot = require("./chatbot.js");
	this.low = require("lowdb");
	this.FileSync = require("lowdb/adapters/FileSync");
	this.adapter = new this.FileSync("./db.json");
	this.db = new this.low(this.adapter);
	this.db.defaults({users: []}).write();
	client = require("rucaptcha-client").create(options.rucaptcha_key);

	var self = this;

	this.addCommand = function(variations, description, admin_only, callback) {
		self.commands.push(new Command(variations, description, admin_only, callback));
	};

	this.createUser = function(id) {
		return new Promise(async function(res, rej) {
			var u = await self.vk.users.get({user_ids: id});
			var r = self.db.get("users").push({
				id: id,
				nick: u[0].first_name
			}).write();
			res(r);
		});
	};

	console.log("Core configuration initialized");

	this.vk.init_longpoll();

	console.log("LongPoll initialized (hopefully)");

	setInterval(function() {
		self.mps = {};
	}, 1000);

	this.vk.on("message", async function(event, plain_message) {
		var message = new Message(plain_message);

		if (message.out) return;

		if (self.admin_only && message.from_id != self.admin_id) return;

		if (self.ignore.indexOf(message.from_id) > -1) return;

		if (self.mentions.indexOf(message.mention.toLowerCase()) == -1) return;

		var user;

		try {
			user = self.db.get("users").find({id: message.from_id}).value();
		} catch (e) {} // ignoring

		if (!user) {
			var a = await self.createUser(message.from_id);
			try {
				user = self.db.get("users").find({id: message.from_id}).value();
			} catch (e) {
				message.replyPlain("Ща, падажжи, нада тебе аккаунт создать");
			}
		}

		message.send = function (body, data) {
			new_body = `[id${user.id}|${user.nick}], ${body}`;
			message.sendPlain(new_body, data);
		}

		message.reply = function (body, data) {
			new_body = `[id${user.id}|${user.nick}], ${body}`;
			message.replyPlain(new_body, data);
		}

		self.mps[message.from_id] = (self.mps[message.from_id] || 0) + 1;

		if (self.mps[message.from_id] > 4) {
			message.reply("Вы были забанены за флуд, а ибо нефиг.", {attachment: "video71358147_456239101"});
			return self.ignore.push(message.from_id);
		}

		var command = self.commands.find(function (cmd) {
			return cmd.variations.indexOf(message.cmd.toLowerCase()) > -1;
		});

		console.log(`${message.from_id}/${message.chat_id || 0}: ${message.body}`);

		if (!command) return self.chatBot.query(`${message.cmd} ${message.search}`, (a) => message.send(a || "Здесь мог бы быть ваш ответ"));

		if (command.admin_only && message.from_id != self.admin_id) return message.reply("У вас нет прав администратора!");

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