/*

HHHHHHHHH     HHHHHHHHH                                 hhhhhhh             BBBBBBBBBBBBBBBBB                             tttt          
H:::::::H     H:::::::H                                 h:::::h             B::::::::::::::::B                         ttt:::t          
H:::::::H     H:::::::H                                 h:::::h             B::::::BBBBBB:::::B                        t:::::t          
HH::::::H     H::::::HH                                 h:::::h             BB:::::B     B:::::B                       t:::::t          
  H:::::H     H:::::H    aaaaaaaaaaaaa      ssssssssss   h::::h hhhhh         B::::B     B:::::B   ooooooooooo   ttttttt:::::ttttttt    
  H:::::H     H:::::H    a::::::::::::a   ss::::::::::s  h::::hh:::::hhh      B::::B     B:::::B oo:::::::::::oo t:::::::::::::::::t    
  H::::::HHHHH::::::H    aaaaaaaaa:::::ass:::::::::::::s h::::::::::::::hh    B::::BBBBBB:::::B o:::::::::::::::ot:::::::::::::::::t    
  H:::::::::::::::::H             a::::as::::::ssss:::::sh:::::::hhh::::::h   B:::::::::::::BB  o:::::ooooo:::::otttttt:::::::tttttt    
  H:::::::::::::::::H      aaaaaaa:::::a s:::::s  ssssss h::::::h   h::::::h  B::::BBBBBB:::::B o::::o     o::::o      t:::::t          
  H::::::HHHHH::::::H    aa::::::::::::a   s::::::s      h:::::h     h:::::h  B::::B     B:::::Bo::::o     o::::o      t:::::t          
  H:::::H     H:::::H   a::::aaaa::::::a      s::::::s   h:::::h     h:::::h  B::::B     B:::::Bo::::o     o::::o      t:::::t          
  H:::::H     H:::::H  a::::a    a:::::assssss   s:::::s h:::::h     h:::::h  B::::B     B:::::Bo::::o     o::::o      t:::::t    tttttt
HH::::::H     H::::::HHa::::a    a:::::as:::::ssss::::::sh:::::h     h:::::hBB:::::BBBBBB::::::Bo:::::ooooo:::::o      t::::::tttt:::::t
H:::::::H     H:::::::Ha:::::aaaa::::::as::::::::::::::s h:::::h     h:::::hB:::::::::::::::::B o:::::::::::::::o      tt::::::::::::::t
H:::::::H     H:::::::H a::::::::::aa:::as:::::::::::ss  h:::::h     h:::::hB::::::::::::::::B   oo:::::::::::oo         tt:::::::::::tt
HHHHHHHHH     HHHHHHHHH  aaaaaaaaaa  aaaa sssssssssss    hhhhhhh     hhhhhhhBBBBBBBBBBBBBBBBB      ooooooooooo             ttttttttttt  

┌┐ ┬ ┬  ┬  ┬┌┬┐┬ ┬┬┬ ┬┌┬┐     ┬┌─┐
├┴┐└┬┘  │  │ │ ├─┤││ ││││     │└─┐
└─┘ ┴   ┴─┘┴ ┴ ┴ ┴┴└─┘┴ ┴────└┘└─┘

*/
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
	// this.ignore = [];
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
				nick: u[0].first_name,
				isBanned: false,
				unbanTime: 0, // -1: banned forever, 0: not banned, >0: unban at <unix timestamp>
				banReason: ""
			}).write();
			res(r);
		});
	};

	// setInterval(function() {
	// 	self.db.get("users").find({isBanned: true, unbanTime: 0}).assign({isBanned: false, banReason: ""}).write();
	// 	bu = self.db.get("users").find(e => e.isBanned && e.unbanTime > 0).value();
	// 	if (bu) {
	// 		bu.unbanTime--;
	// 		self.db.get("users").find({id: bu.id}).assign(bu).write();
	// 	}
	// }, 1000);

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

		// if (self.ignore.indexOf(message.from_id) > -1) return;

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

		if (user.unbanTime <= Date.now() && user.unbanTime > 0 && user.isBanned) {
			user.isBanned = false;
			user.unbanTime = 0;
			user.banReason = "";
			self.db.get("users").find({id: user.id}).assign(user).write();
		}

		if (user.isBanned) return;

		message.send = function(body, data) {
			new_body = `[id${user.id}|${user.nick}], ${body}`;
			message.sendPlain(new_body, data);
		}

		message.reply = function(body, data) {
			new_body = `[id${user.id}|${user.nick}], ${body}`;
			message.replyPlain(new_body, data);
		}

		message.sendPhoto = function(p, t) {
			new_t = `[id${user.id}|${user.nick}], ${t || ""}`;
			message.sendPhotoPlain(p, new_t);
		}

		self.mps[message.from_id] = (self.mps[message.from_id] || 0) + 1;

		if (self.mps[message.from_id] >= 3) {
			message.reply("Вы были забанены за флуд на один час.", {attachment: "video71358147_456239101"});
			user.isBanned = true;
			user.unbanTime = Date.now() + 3600000;
			user.banReason = "Флуд.";
			self.db.get("users").find({id: user.id}).assign(user).write();
			return;
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
