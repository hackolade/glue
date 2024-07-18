const { FetchHttpHandler } = require('@aws-sdk/fetch-http-handler');

class HttpHandler {
	handler = null;

	constructor(agent) {
		this.agent = agent;
		this.handler = new FetchHttpHandler();
	}

	get() {
		return this.handler;
	}
}

module.exports = { HttpHandler };
