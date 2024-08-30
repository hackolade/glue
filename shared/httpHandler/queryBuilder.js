function queryBuilder({ query }) {
	const parts = [];

	for (const key of Object.keys(query)) {
		const value = query[key];
		const escapedKey = encodeURIComponent(key);

		if (Array.isArray(value)) {
			value.forEach(arrayValue => {
				parts.push(`${escapedKey}=${encodeURIComponent(arrayValue)}`);
			});
		} else {
			let qsEntry = escapedKey;

			if (value || typeof value === 'string') {
				qsEntry += `=${encodeURIComponent(value)}`;
			}
			parts.push(qsEntry);
		}
	}

	return parts.join('&');
}

module.exports = { queryBuilder };
