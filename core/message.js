var Message = function(plain_msg) {
	var self = this;
	for (key in plain_msg) {
		self[key] = plain_msg[key];
	}
	this.sendPlain = plain_msg.send;
	this.replyPlain = plain_msg.reply;
	this.struct = this.body.split(" ");
	this.mention = this.struct[0];
	this.cmd = this.struct[1];
	this.args = this.struct.slice(2);
	this.search = this.args.join(" ");
};

module.exports = Message;