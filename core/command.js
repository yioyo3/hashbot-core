var Command = function(variations, description, admin_only, callback) {
	this.variations = variations;
	this.description = description;
	this.admin_only = admin_only;
	this.callback = callback;
}

module.exports = Command;