const { GlueClient, CreateDatabaseCommand, CreateTableCommand, GetDatabasesCommand } = require('@aws-sdk/client-glue');
const { hckFetchAwsSdkHttpHandler } = require('@hackolade/fetch');
const { getApiStatements } = require('./helpers/awsCliScriptHelpers/applyToInstanceHelper');
const { generateScript } = require('./helpers/generateScript');
const { generateContainerScript } = require('./helpers/generateContainerScript');

module.exports = {
	generateScript,

	generateContainerScript,

	async applyToInstance(data, logger, callback) {
		if (!data.script) {
			return callback({ message: 'Empty script' });
		}

		const glueInstance = getGlueInstance({ connectionInfo: data, logger });

		try {
			const { db, table } = getApiStatements(data.script);
			if (db.length === 0 && table.length === 0) {
				return callback({ message: 'HiveQL is not supported for this operation' });
			}
			const dbCreatePromises = db.map(async statement => {
				logger.progress({ message: 'Creating database', containerName: statement.DatabaseInput.Name });
				const command = new CreateDatabaseCommand(statement);
				return await glueInstance.send(command);
			});
			await Promise.all(dbCreatePromises);
			const tableCreatePromises = table.map(async statement => {
				logger.progress({
					message: 'Creating database',
					containerName: statement.DatabaseName,
					entityName: statement.TableInput.Name,
				});
				const command = new CreateTableCommand(statement);
				return await glueInstance.send(command);
			});
			await Promise.all(tableCreatePromises);
			callback();
		} catch (err) {
			callback(err);
		}
	},

	async testConnection(connectionInfo, logger, callback) {
		const glueInstance = getGlueInstance({ connectionInfo, logger });

		try {
			const command = new GetDatabasesCommand();
			await glueInstance.send(command);
			callback();
		} catch (err) {
			logger.log('error', { message: err.message, stack: err.stack, error: err }, 'Connection failed');
			callback(err);
		}
	},
};

const getGlueInstance = ({ connectionInfo }) => {
	const { accessKeyId, secretAccessKey, region, sessionToken, queryRequestTimeout } = connectionInfo;
	const httpHandler = hckFetchAwsSdkHttpHandler({ requestTimeout: queryRequestTimeout });

	return new GlueClient({
		region,
		credentials: {
			accessKeyId,
			secretAccessKey,
			sessionToken,
		},
		requestHandler: httpHandler,
	});
};
