var Command = function(variations, description, accessLevel, callback) {
	this.variations = variations;
	this.description = description;
	this.accessLevel = accessLevel;
	this.callback = callback;
}

module.exports = Command;