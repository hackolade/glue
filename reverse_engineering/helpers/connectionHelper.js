const {
	GlueClient,
	GetTableCommand,
	GetTablesCommand,
	GetDatabaseCommand,
	GetDatabasesCommand,
} = require('@aws-sdk/client-glue');
const { hckFetchAwsSdkHttpHandler } = require('@hackolade/fetch');
const { mapTableData } = require('./tablePropertiesHelper');

let connection;
let databaseLoadContinuationToken;

const MAX_RESULTS = 100;

const createConnection = async ({ connectionInfo }) => {
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
const connect = async ({ connectionInfo, logger }) => {
	if (connection) {
		return connection;
	}

	connection = await createConnection({ connectionInfo, logger });

	return connection;
};

const close = () => {
	if (connection) {
		connection = null;
	}

	if (databaseLoadContinuationToken) {
		databaseLoadContinuationToken = null;
	}
};

const createInstance = ({ connection, logger = {} }) => {
	const getDatabases = async () => {
		const command = new GetDatabasesCommand({ MaxResults: MAX_RESULTS, NextToken: databaseLoadContinuationToken });
		const dbsData = await connection.send(command);

		databaseLoadContinuationToken = dbsData.NextToken ? dbsData.NextToken : null;

		return {
			databaseList: dbsData.DatabaseList,
			isFullyUploaded: !dbsData.NextToken,
		};
	};

	const getDatabaseDescription = async dbName => {
		const command = new GetDatabaseCommand({ Name: dbName });
		const db = await connection.send(command);
		return db.Database.Description;
	};

	const getTableList = async (dbName, nextToken) => {
		const command = new GetTablesCommand({ DatabaseName: dbName, ...(nextToken && { NextToken: nextToken }) });
		const tableListResponse = await connection.send(command);

		let nextTableList = [];
		if (tableListResponse.NextToken) {
			nextTableList = await getTableList(dbName, tableListResponse.NextToken);
		}

		return [...tableListResponse.TableList, ...nextTableList];
	};

	const getTables = async dbName => {
		const dbCollectionsData = await getTableList(dbName);
		return dbCollectionsData.map(({ Name }) => Name);
	};

	const getTable = async (dbName, tableName) => {
		const command = new GetTableCommand({ DatabaseName: dbName, Name: tableName });

		const rawTableData = await connection.send(command);

		return mapTableData({ tableData: rawTableData, logger });
	};

	return {
		getDatabaseDescription,
		getDatabases,
		getTables,
		getTable,
	};
};

module.exports = {
	createInstance,
	connect,
	close,
};
