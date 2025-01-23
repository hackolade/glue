const { get } = require('lodash');
const { getGlueDatabaseCreateStatement } = require('./awsCliScriptHelpers/glueDatabaseHeleper');
const { getGlueTableCreateStatement } = require('./awsCliScriptHelpers/glueTableHelper');

const buildAWSCLIScript = (containerData, tableSchema) => {
	const dbStatement = getGlueDatabaseCreateStatement(containerData[0]);
	const tableStatement = getGlueTableCreateStatement(tableSchema, containerData[0].name);
	return composeCLIStatements([dbStatement, tableStatement]);
};

const buildAWSCLIModelScript = (containerData, tablesSchemas = {}) => {
	const dbStatement = getGlueDatabaseCreateStatement(containerData[0]);
	const tablesStatements = Object.entries(tablesSchemas).map(([key, value]) => {
		return getGlueTableCreateStatement(value, get(containerData[0], 'name', ''));
	});
	return composeCLIStatements([dbStatement, ...tablesStatements]);
};

const composeCLIStatements = (statements = []) => {
	return statements.join('\n\n');
};

module.exports = { buildAWSCLIScript, buildAWSCLIModelScript };
