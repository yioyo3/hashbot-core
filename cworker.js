let closest = require("closest-str");

module.exports = function(input, done) {
	closest.__dict = input.dict;

	closest.setmax(0.96);

	done(closest.request(input.query).answer);
}
