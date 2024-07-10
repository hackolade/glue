const {
	GlueClient,
	GetTableCommand,
	GetTablesCommand,
	GetDatabaseCommand,
	GetDatabasesCommand,
} = require('@aws-sdk/client-glue');
const fs = require('fs');
const https = require('https');
const { mapTableData } = require('./tablePropertiesHelper');

let connection;
let databaseLoadContinuationToken;

const MAX_RESULTS = 100;

const readCertificateFile = path => {
	if (!path) {
		return Promise.resolve('');
	}

	return new Promise(resolve => {
		fs.readFile(path, 'utf8', (err, data) => {
			if (err) {
				resolve('');
			}
			resolve(data);
		});
	});
};
const getSslOptions = async connectionInfo => {
	switch (connectionInfo.sslType) {
		case 'Server validation': {
			const certAuthority = await readCertificateFile(connectionInfo.certAuthorityPath);
			return {
				ssl: true,
				ca: [certAuthority],
			};
		}
		case 'Server and client validation': {
			const certAuthority = await readCertificateFile(connectionInfo.certAuthorityPath);
			const key = await readCertificateFile(connectionInfo.clientPrivateKey);
			const cert = await readCertificateFile(connectionInfo.clientCert);
			return {
				ssl: true,
				ca: [certAuthority],
				key: [key],
				cert: [cert],
				passphrase: connectionInfo.clientKeyPassword,
			};
		}
		default:
			return { ssl: false };
	}
};

const createConnection = async connectionInfo => {
	const { accessKeyId, secretAccessKey, region, sessionToken } = connectionInfo;
	const sslOptions = await getSslOptions(connectionInfo);
	const httpOptions = sslOptions.ssl
		? {
				httpOptions: {
					agent: new https.Agent({
						rejectUnauthorized: true,
						...sslOptions,
					}),
				},
				...sslOptions,
			}
		: {};

	return new GlueClient({
		region,
		credentials: {
			accessKeyId,
			secretAccessKey,
			sessionToken,
		},
		// TODO: verify ssl options to be applied correctly
		...httpOptions,
	});
};
const connect = async connectionInfo => {
	if (connection) {
		return connection;
	}

	connection = await createConnection(connectionInfo);

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

const createInstance = (connection, _) => {
	const getDatabases = async () => {
		const command = new GetDatabasesCommand({ MaxResults: MAX_RESULTS, NextToken: databaseLoadContinuationToken });
		const dbsData = await connection.send(command);

		databaseLoadContinuationToken = dbsData.NextToken ? dbsData.NextToken : null;

		return {
			databaseList: dbsData.DatabaseList,
			isFullyUploaded: !Boolean(dbsData.NextToken),
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

		return mapTableData(rawTableData, _);
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
