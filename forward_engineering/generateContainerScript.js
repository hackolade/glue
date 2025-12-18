const { parseEntities } = require('./hiveHelpers/helpers/parseEntities');
const { generateContainerScript: generateHiveContainerScript } = require('./hiveHelpers/generateContainerScript');
const { buildAWSCLIModelScript } = require('./awsCliScriptHelpers/awsScriptHelper');
const { SCRIPT_FORMAT } = require('../shared/constants');

function generateContainerScript(data, logger, callback, app) {
	try {
		const containerData = data.containerData;
		const jsonSchema = parseEntities(data.entities, data.jsonSchema);

		if (data.options.targetScriptOptions?.keyword === SCRIPT_FORMAT.hiveQL) {
			generateHiveContainerScript(data, logger, callback, app);
			return;
		}

		const script = buildAWSCLIModelScript(containerData, jsonSchema);
		return callback(null, script);
	} catch (e) {
		logger.log('error', { message: e.message, stack: e.stack }, 'Glue Forward-Engineering Error');

		setTimeout(() => {
			callback({ message: e.message, stack: e.stack });
		}, 150);
	}
}

module.exports = { generateContainerScript };
