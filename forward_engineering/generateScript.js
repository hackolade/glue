const { generateScript: generateHiveScript } = require('./hiveHelpers/generateScript');
const { buildAWSCLIScript } = require('./awsCliScriptHelpers/awsScriptHelper');
const { SCRIPT_FORMAT } = require('../shared/constants');

function generateScript(data, logger, callback, app) {
	try {
		const jsonSchema = JSON.parse(data.jsonSchema);
		const containerData = data.containerData;

		if (data.options.targetScriptOptions?.keyword === SCRIPT_FORMAT.hiveQL) {
			generateHiveScript(data, logger, callback, app);
			return;
		}

		const script = buildAWSCLIScript(containerData, jsonSchema);
		return callback(null, script);
	} catch (e) {
		logger.log('error', { message: e.message, stack: e.stack }, 'AWS Glue -Engineering Error');

		setTimeout(() => {
			callback({ message: e.message, stack: e.stack });
		}, 150);
	}
}

module.exports = { generateScript };
