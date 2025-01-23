const sqlFormatter = require('../custom_modules/sql-formatter');

const buildHiveScript =
	needMinify =>
	(...statements) => {
		const script = statements.filter(statement => statement).join('\n\n');
		if (needMinify) {
			return script + '\n';
		}

		return sqlFormatter.format(script, { indent: '    ' }) + '\n';
	};

module.exports = { buildHiveScript };
