/**
 * @typedef {import('@aws-sdk/client-glue/dist-types/GlueClient').ClientDefaults[requestHandler]} RequestHandler
 **/

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

	/**
	 * Handles an HTTP request.
	 *
	 * @param { HttpRequest } request - The HTTP request to handle.
	 * @param { Object } [options] - The handler options.
	 * @param { AbortSignal } [options.abortSignal] - An abort signal to cancel the request.
	 * @returns { Promise<{ response: HttpResponse }> } A promise that resolves with the HTTP response.
	 */
	handle(request, { abortSignal } = {}) {
		const requestTimeoutInMs = this.requestTimeout;

		// if the request was already aborted, prevent doing extra work
		if (abortSignal?.aborted) {
			const abortError = new Error('Request aborted');
			abortError.name = 'AbortError';
			return Promise.reject(abortError);
		}

		let path = request.path;
		if (request.query) {
			// const queryString = buildQueryString(request.query);
			// if (queryString) {
			// 	path += `?${queryString}`;
			// }
		}

		const { port, method } = request;
		const url = `${request.protocol}//${request.hostname}${port ? `:${port}` : ''}${path}`;

		const body = method === 'GET' || method === 'HEAD' ? undefined : request.body;
		const requestOptions = {
			body,
			headers: new Headers(request.headers),
			method: method,
		};

		if (typeof AbortController !== 'undefined') {
			requestOptions['signal'] = abortSignal;
		}

		const fetchRequest = new Request(url, requestOptions);
		const raceOfPromises = [
			fetch(fetchRequest).then(response => {
				const fetchHeaders = response.headers;
				const transformedHeaders = {};

				for (const pair of fetchHeaders.entries()) {
					transformedHeaders[pair[0]] = pair[1];
				}

				const hasReadableStream = response.body !== undefined;

				// Return the response with buffered body
				if (!hasReadableStream) {
					return response.blob().then(body => ({
						// response: new HttpResponse({
						// 	headers: transformedHeaders,
						// 	statusCode: response.status,
						// 	body,
						// }),
					}));
				}
				// Return the response with streaming body
				return {
					// response: new HttpResponse({
					// 	headers: transformedHeaders,
					// 	statusCode: response.status,
					// 	body: response.body,
					// }),
				};
			}),
			// requestTimeout(requestTimeoutInMs),
		];
		if (abortSignal) {
			raceOfPromises.push(
				new Promise()((resolve, reject) => {
					abortSignal.onabort = () => {
						const abortError = new Error('Request aborted');
						abortError.name = 'AbortError';
						reject(abortError);
					};
				}),
			);
		}
		return Promise.race(raceOfPromises);
	}
}

module.exports = { HttpHandler };
