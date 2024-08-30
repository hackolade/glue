function requestTimeout({ requestTimeout = 0 }) {
	return new Promise((_, reject) => {
		if (requestTimeout) {
			setTimeout(() => {
				const timeoutError = new Error(`Request did not complete within ${requestTimeout} ms`);
				timeoutError.name = 'TimeoutError';
				reject(timeoutError);
			}, requestTimeout);
		}
	});
}

module.exports = { requestTimeout };
