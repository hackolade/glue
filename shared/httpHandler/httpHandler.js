/**
 * @typedef {import('@aws-sdk/client-glue/dist-types/GlueClient').ClientDefaults[requestHandler]} RequestHandler
 * @typedef {import('@smithy/protocol-http/dist-types').HttpRequest} HttpRequest
 * @typedef {import('@smithy/protocol-http/dist-types').HttpResponse} HttpResponse
 **/

const { net } = require('electron');
const { isEmpty } = require('lodash');
const { requestTimeout } = require('./requestTimeout');

/**
 * @class
 * @implements { RequestHandler }
 */
class HttpHandler {
	constructor({ requestTimeout, logger } = {}) {
		this.requestTimeout = requestTimeout;
		this.logger = logger;
	}

	getAbortError = () => {
		const abortError = new Error('Request aborted');
		abortError.name = 'AbortError';
		return abortError;
	};

	/**
	 * @param { HttpRequest } request
	 * @param { Object } [options]
	 * @param { AbortSignal } [options.abortSignal]
	 * @returns { Promise<{ response: HttpResponse }> }
	 */
	async handle(request, { abortSignal } = {}) {
		if (abortSignal?.aborted) {
			throw this.getAbortError();
		}

		const { method, query, protocol, port, hostname, body, headers: requestHeaders } = request;

		const headers = new Headers(requestHeaders);
		const headersToSkip = ['content-length', 'host'];
		headersToSkip.forEach(header => headers.delete(header));

		let { path } = request;

		if (!isEmpty(query) && typeof query === 'object') {
			path += `?${new URLSearchParams(query).toString()}`;
		}

		const portParam = port ? `:${port}` : '';

		const url = `${protocol}//${hostname}${portParam}${path}`;

		const methodsWithoutBody = ['GET', 'HEAD'];

		const requestOptions = {
			body: methodsWithoutBody.includes(method) ? undefined : body,
			headers,
			method,
		};

		if (typeof AbortController !== 'undefined') {
			requestOptions.signal = abortSignal;
		}

		const fetchRequest = new Request(url, requestOptions);

		this.logger?.log('info', { fetchRequest }, 'RE http request');

		const resultResolver = async result => {
			const fetchHeaders = result.headers;
			const transformedHeaders = Object.fromEntries(fetchHeaders.entries());

			const hasReadableStream = result.body !== undefined;

			const response = {
				headers: transformedHeaders,
				statusCode: result.status,
				body: hasReadableStream ? result.body : await result.blob(),
			};

			return { response };
		};

		const race = [
			net.fetch(fetchRequest).then(resultResolver),
			requestTimeout({ requestTimeout: this.requestTimeout }),
		];

		if (abortSignal) {
			race.push(
				new Promise((resolve, reject) => {
					abortSignal.onabort = () => {
						reject(this.getAbortError());
					};
				}),
			);
		}

		return Promise.race(race);
	}
}

module.exports = { HttpHandler };
