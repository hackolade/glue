const { get } = require('lodash');
const { buildHiveScript } = require('./buildHiveScript');
const { getDatabaseStatement } = require('./databaseHelper');
const { getTableStatement } = require('./tableHelper');
const { getIndexes } = require('./indexHelper');
const { buildAWSCLIScript } = require('./awsScriptHelper');

function generateScript(data, logger, callback) {
	try {
		const jsonSchema = JSON.parse(data.jsonSchema);
		const modelDefinitions = JSON.parse(data.modelDefinitions);
		const internalDefinitions = JSON.parse(data.internalDefinitions);
		const externalDefinitions = JSON.parse(data.externalDefinitions);
		const containerData = data.containerData;
		const entityData = data.entityData;

		if (data.options.targetScriptOptions && data.options.targetScriptOptions.keyword === 'hiveQl') {
			const needMinify = get(data, 'options.additionalOptions', []).find(option => option.id === 'minify')?.value;

			return callback(
				null,
				buildHiveScript(needMinify)(
					getDatabaseStatement(containerData),
					getTableStatement(containerData, entityData, jsonSchema, [
						modelDefinitions,
						internalDefinitions,
						externalDefinitions,
					]),
					getIndexes(containerData, entityData, jsonSchema, [
						modelDefinitions,
						internalDefinitions,
						externalDefinitions,
					]),
				),
			);
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
