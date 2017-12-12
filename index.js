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

var Message = require("./message.js");
var Command = require("./command.js");
var https = require("https");
var Image = require("image-binary");
var logger = require("sloger");
logger.add("cmd", "\033[44m CMD  \033[0m"); 
logger.add("init", "\033[102;30m INIT \033[0m");
logger.add("captcha", "\033[104m CAPT \033[0m");
logger.add("prej", "\033[41m PREJ \033[0m", true);
logger.add("user", "\033[102;30m USER \033[0m");

process.on("uncaughtException", function(e) {
	logger.error(e);
});

var Core = function(options) {
	logger.init("Initializing core...");
	this.VK = require("VK-Promise");
	if (!options.access_token) throw new Error("No access_token passed.")
	this.vk = new this.VK(options.access_token);
	this.commands = [];
	this.mentions = options.mentions || ["бот", "bot"];
	this.mps = {};
	this.chatBot = require("./chatbot.js");
	this.low = require("lowdb");
	this.FileSync = require("lowdb/adapters/FileSync");
	this.adapter = new this.FileSync("./hashbotDB.json");
	this.db = new this.low(this.adapter);
	this.db.defaults({users: []}).write();
	if (options.rucaptcha_key) {
		client = require("rucaptcha-client").create(options.rucaptcha_key);
	}
	linkchecker = /([\w\-_]+(?:(?:\.|\s*\[dot\]\s*[A-Z\-_]+)+))([A-Z\-\.,@?^=%&:/~\+#]*[A-Z\-\@?^=%&/~\+#]){2,3}?/gi;

	var self = this;

	this.addCommand = function(variations, description, accessLevel, callback) {
		self.commands.push(new Command(variations, description, accessLevel, callback));
	};

	this.createUser = function(id) {
		return new Promise(async function(res, rej) {
			var u = await self.vk.users.get({user_ids: id});
			var r = self.db.get("users").push({
				id: id,
				nick: u[0].first_name,
				isBanned: false,
				unbanTime: 0, // -1: banned forever, 0: not banned, >0: unban at <unix timestamp>
				banReason: "",
				accessLevel: 0 // 0: usr, 1: vip, 2: mod, 3: adm, 4: dev
			}).write();
			res(r);
		});
	};

	logger.init("Core configuration initialized");

	this.vk.init_longpoll();

	logger.init("LongPoll initialized (hopefully)");

	setInterval(function() {
		self.mps = {};
	}, 1000);

	this.vk.on("message", async function(event, plain_message) {
		var message = new Message(plain_message);

		if (message.out) return;

		if (self.admin_only && message.from_id != self.admin_id) return;

		if (self.mentions.indexOf(message.mention.toLowerCase()) == -1) return;

		var user;

		try {
			user = self.db.get("users").find({id: message.from_id}).value();
		} catch (e) {} // ignoring

		if (!user) {
			var a = await self.createUser(message.from_id);
			logger.user(message.from_id);
			try {
				user = self.db.get("users").find({id: message.from_id}).value();
			} catch (e) {} // ignoring (yet again)
		}

		if (user.unbanTime <= Date.now() && user.unbanTime > 0 && user.isBanned) {
			user.isBanned = false;
			user.unbanTime = 0;
			user.banReason = "";
			self.db.get("users").find({id: user.id}).assign(user).write();
		}

		if (user.isBanned) return;

		message.send = function(body, data) {
			return new Promise(function(resolve, reject) {
				new_body = `[id${user.id}|${user.nick}], ${body}`;
				message.sendPlain(new_body.replace(linkchecker, "<LINK>"), data).then(resolve, reject);
			});
		}

		message.reply = function(body, data) {
			return new Promise(function(resolve, reject) {
				new_body = `[id${user.id}|${user.nick}], ${body}`;
				message.replyPlain(new_body.replace(linkchecker, "<LINK>"), data).then(resolve, reject);
			});
		}

		message.sendPhoto = function(p, t) {
			return new Promise(function(resolve, reject) {
				new_t = `[id${user.id}|${user.nick}], ${t || ""}`;
				message.sendPhotoPlain(p, new_t.replace(linkchecker, "<LINK>")).then(resolve, reject);
			});
		}

		message.user = user;

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

		logger.cmd(`${message.from_id}/${message.chat_id || 0}: ${message.body}`);

		if (!command) return self.chatBot.query(`${message.cmd} ${message.search}`, (a) => message.send(a || "Здесь мог бы быть ваш ответ"));

		if (command.accessLevel > user.accessLevel) return message.reply("у вас нет необходимых прав!");

		try {
			command.callback(message);
		} catch(e) {
			logger.warn(e.stack);
		}
	});

	this.vk.on("captcha", function(event, data) {
		if (client) {
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
				logger.captcha('Balance: ' + balance);
				logger.captcha('Answer: ' + answer.text);
				data.submit(answer.text);
			});
		} else {
			logger.warn("No captcha key supplied, ignoring captcha");
		}
	});

	logger.ok("Core initialized, awaiting commands");
};

module.exports = Core;
