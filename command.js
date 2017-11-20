var Command = function(variations, description, access_level, callback) {
	this.variations = variations;
	this.description = description;
	this.access_level = access_level;
	this.callback = callback;
}

module.exports = Command;