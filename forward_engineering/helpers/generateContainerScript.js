const { get } = require('lodash');
const { getDatabaseStatement } = require('./databaseHelper');
const foreignKeyHelper = require('./foreignKeyHelper');
const { getTableStatement } = require('./tableHelper');
const { getIndexes } = require('./indexHelper');
const { buildHiveScript } = require('./buildHiveScript');
const { buildAWSCLIModelScript } = require('./awsScriptHelper');

function generateContainerScript(data, logger, callback) {
	try {
		const containerData = data.containerData;
		const modelDefinitions = JSON.parse(data.modelDefinitions);
		const externalDefinitions = JSON.parse(data.externalDefinitions);
		const databaseStatement = getDatabaseStatement(containerData);
		const jsonSchema = parseEntities(data.entities, data.jsonSchema);
		const internalDefinitions = parseEntities(data.entities, data.internalDefinitions);
		if (data.options.targetScriptOptions && data.options.targetScriptOptions.keyword === 'hiveQl') {
			const needMinify = (get(data, 'options.additionalOptions', []).find(option => option.id === 'minify') || {})
				.value;

			const foreignKeyHashTable = foreignKeyHelper.getForeignKeyHashTable(
				data.relationships,
				data.entities,
				data.entityData,
				jsonSchema,
				internalDefinitions,
				[modelDefinitions, externalDefinitions],
				[modelDefinitions, externalDefinitions],
				containerData[0]?.isActivated,
			);

			const entities = data.entities.reduce((result, entityId) => {
				const args = [
					containerData,
					data.entityData[entityId],
					jsonSchema[entityId],
					[internalDefinitions[entityId], modelDefinitions, externalDefinitions],
				];

				return result.concat([getTableStatement(...args), getIndexes(...args)]);
			}, []);

			const foreignKeys = data.entities
				.reduce((result, entityId) => {
					const foreignKeyStatement = foreignKeyHelper.getForeignKeyStatementsByHashItem(
						foreignKeyHashTable[entityId] || {},
					);

					if (foreignKeyStatement) {
						return [...result, foreignKeyStatement];
					}

					return result;
				}, [])
				.join('\n');

			return callback(null, buildHiveScript(needMinify)(databaseStatement, ...entities, foreignKeys));
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

const parseEntities = (entities, serializedItems) => {
	return entities.reduce((result, entityId) => {
		try {
			return {
				...result,
				[entityId]: JSON.parse(serializedItems[entityId]),
			};
		} catch (e) {
			return result;
		}
	}, {});
};

module.exports = { generateContainerScript };
