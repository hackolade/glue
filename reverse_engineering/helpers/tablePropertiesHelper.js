const { get } = require('lodash');

const mapSortColumns = (items = []) => {
	return items.map(item => ({
		name: item.Column,
		type: item.SortOrder === 1 ? 'ascending' : 'descending',
	}));
};

const getSerDeLibrary = (data = {}) => {
	return data.SerializationLibrary;
};

const mapSerDePaths = (data = {}) => {
	return get(data, 'Parameters.paths', '').split(',');
};

const mapSerDeParameters = (parameters = {}) => {
	return Object.entries(parameters).reduce((acc, [key, value]) => {
		if (key !== 'paths') {
			acc.push({ serDeKey: key, serDeValue: value });
		}
		return acc;
	}, []);
};

const getClassification = (parameters = {}) => {
	if (parameters.classification) {
		switch (parameters.classification.toLowerCase()) {
			case 'avro':
				return 'Avro';
			case 'csv':
				return 'CSV';
			case 'json':
				return 'JSON';
			case 'xml':
				return 'XML';
			case 'parquet':
				return 'Parquet';
			case 'orc':
				return 'ORC';
		}
	}
	return {};
};

const mapTableProperties = (parameters = {}) => {
	return Object.entries(parameters).reduce((acc, [key, value]) => {
		if (key === 'classification') {
			return acc;
		}
		return acc.concat({
			tablePropKey: key,
			tablePropValue: value,
		});
	}, []);
};

const getNumBuckets = (numBuckets = 0) => {
	return numBuckets < 1 ? undefined : numBuckets;
};

const mapColumns = ({ columns = [], logger = {} }) => {
	let hasErrors = false;

	const mapped = columns.map(({ Type, Name, Comment }) => {
		if (!Type || !Name) {
			hasErrors = true;
		}
		return { name: Name, type: Type, comments: Comment };
	});

	if (hasErrors) {
		logger.log('info', columns, 'Some columns are missing required Type or Name');
	}

	return mapped;
};

const mapTableData = ({ tableData, logger }) => {
	const partitionKeys = mapColumns({ columns: tableData.Table.PartitionKeys, logger });

	return {
		name: tableData.Table.Name,
		entityLevelData: {
			description: tableData.Table.Description,
			externalTable: tableData.Table.TableType === 'EXTERNAL_TABLE',
			tableProperties: mapTableProperties(tableData.Table.Parameters),
			compositePartitionKey: partitionKeys.map(item => item.name),
			compositeClusteringKey: tableData.Table.StorageDescriptor?.BucketColumns,
			sortedByKey: mapSortColumns(tableData.Table.StorageDescriptor?.SortColumns),
			compressed: tableData.Table.StorageDescriptor?.Compressed,
			location: tableData.Table.StorageDescriptor?.Location,
			numBuckets: getNumBuckets(tableData.Table.StorageDescriptor?.NumberOfBuckets),
			StoredAsSubDirectories: tableData.Table.StorageDescriptor?.StoredAsSubDirectories,
			inputFormatClassname: tableData.Table.StorageDescriptor?.InputFormat,
			outputFormatClassname: tableData.Table.StorageDescriptor?.OutputFormat,
			serDeLibrary: getSerDeLibrary(tableData.Table.StorageDescriptor?.SerdeInfo),
			parameterPaths: mapSerDePaths(tableData.Table.StorageDescriptor?.SerdeInfo),
			serDeParameters: mapSerDeParameters(tableData.Table.StorageDescriptor?.SerdeInfo?.Parameters),
			classification: getClassification(tableData.Table.Parameters),
		},
		partitionKeys,
		columns: mapColumns({ columns: tableData.Table.StorageDescriptor.Columns, logger }),
	};
};

module.exports = {
	mapTableData,
};
