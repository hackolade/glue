const _ = require('lodash');
const schemaHelper = require('./jsonSchemaHelper');
const { getName, getTab, commentDeactivatedStatements, prepareName } = require('./generalHelper');

const getIdToNameHashTable = (
	relationships,
	entities,
	jsonSchemas,
	internalDefinitions,
	otherDefinitions,
	relatedSchemas,
) => {
	const entitiesForHashing = entities
		.concat(Object.keys(relatedSchemas))
		.filter(entityId =>
			relationships.find(
				relationship => relationship.childCollection === entityId || relationship.parentCollection === entityId,
			),
		);

	return entitiesForHashing.reduce((hashTable, entityId) => {
		return {
			...hashTable,
			...schemaHelper.getIdToNameHashTable(
				[
					jsonSchemas[entityId] ?? relatedSchemas[entityId],
					internalDefinitions[entityId],
					...otherDefinitions,
				].filter(Boolean),
			),
		};
	}, {});
};

const getForeignKeyHashTable = ({
	relationships,
	entities,
	entityData,
	jsonSchemas,
	internalDefinitions,
	otherDefinitions,
	isContainerActivated,
	relatedSchemas,
}) => {
	const idToNameHashTable = getIdToNameHashTable(
		relationships,
		entities,
		jsonSchemas,
		internalDefinitions,
		otherDefinitions,
		relatedSchemas,
	);

	return relationships.reduce((hashTable, relationship) => {
		if (!hashTable[relationship.childCollection]) {
			hashTable[relationship.childCollection] = {};
		}

		const constraintName = relationship.code || relationship.name;
		const parentSchema =
			jsonSchemas[relationship.parentCollection] ?? relatedSchemas[relationship.parentCollection];
		const childSchema = jsonSchemas[relationship.childCollection] ?? relatedSchemas[relationship.childCollection];
		const parentDifferentSchemaName = prepareName(parentSchema?.bucketName) || '';
		const parentTableData = getTab(0, entityData[relationship.parentCollection]);
		const parentTableSingleName = prepareName(getName(parentTableData) || parentSchema?.collectionName) || '';
		const parentTableName = parentDifferentSchemaName
			? `${parentDifferentSchemaName}.${parentTableSingleName}`
			: parentTableSingleName;
		const childTableData = getTab(0, entityData[relationship.childCollection]);
		const childTableName = prepareName(getName(childTableData) || childSchema?.collectionName) || '';
		const groupKey = parentTableName + constraintName;

		if (!hashTable[relationship.childCollection][groupKey]) {
			hashTable[relationship.childCollection][groupKey] = [];
		}
		const disableNoValidate = relationship?.customProperties?.disableNoValidate;

		hashTable[relationship.childCollection][groupKey].push({
			name: relationship.name,
			code: relationship.code,
			disableNoValidate: disableNoValidate,
			parentTableName: parentTableName,
			childTableName: childTableName,
			parentColumns: getForeignColumns(relationship.parentField, idToNameHashTable, parentSchema),
			childColumns: getForeignColumns(relationship.childField, idToNameHashTable, childSchema),
			isActivated: relationship.isActivated !== false && isTableActivated(parentTableData, parentSchema),
			isChildTableActivated: isContainerActivated !== false && isTableActivated(childTableData, childSchema),
		});

		return hashTable;
	}, {});
};

const getForeignKeyConstraint = ({
	constraintName,
	childColumns,
	parentTableName,
	parentColumns,
	disableNoValidate,
}) => {
	const constraintNameStatement = constraintName ? `CONSTRAINT ${prepareName(constraintName)} ` : '';
	const statement = `${constraintNameStatement}FOREIGN KEY (${childColumns}) REFERENCES ${parentTableName}(${parentColumns}) ${disableNoValidate ? 'DISABLE NOVALIDATE' : ''}`;
	return statement.trim();
};

const getForeignKeyColumnsStatements = ({ childColumns, parentColumns, isActivated, isParentActivated = true }) => {
	const columnPairs = _.zip(childColumns, parentColumns)
		.filter(([childColumn, parentColumn]) => childColumn && parentColumn)
		.map(([childColumn, parentColumn]) => ({
			childColumn,
			parentColumn,
			isActivated: childColumn.isActivated !== false && parentColumn.isActivated !== false,
		}));
	const isForeignKeyActivated = isActivated && columnPairs.some(pair => pair.isActivated);
	const [activatedPairs, deactivatedPairs] =
		isForeignKeyActivated && isParentActivated ? _.partition(columnPairs, 'isActivated') : [columnPairs, []];

	const getColumnsStatement = key => {
		const activatedColumns = activatedPairs.map(pair => pair[key].name).join(', ');
		if (!deactivatedPairs.length) {
			return activatedColumns;
		}
		return `${activatedColumns} /*, ${deactivatedPairs.map(pair => pair[key].name).join(', ')} */`;
	};

	return {
		childColumns: getColumnsStatement('childColumn'),
		parentColumns: getColumnsStatement('parentColumn'),
		isActivated: isForeignKeyActivated,
	};
};

const getInlineForeignKeyStatement = ({
	constraintName,
	childColumns,
	parentTableName,
	parentColumns,
	disableNoValidate,
	isActivated,
	isChildTableActivated,
}) => {
	const columnsStatements = getForeignKeyColumnsStatements({
		childColumns,
		parentColumns,
		isActivated,
		isParentActivated: isChildTableActivated,
	});
	const statement = getForeignKeyConstraint({
		constraintName,
		childColumns: columnsStatements.childColumns,
		parentTableName,
		parentColumns: columnsStatements.parentColumns,
		disableNoValidate,
	});

	return commentDeactivatedStatements(statement, !isChildTableActivated || columnsStatements.isActivated);
};

const getForeignKeyStatementsByHashItem = hashItem => {
	return Object.keys(hashItem || {})
		.map(groupKey => {
			const keys = hashItem[groupKey];
			const firstKey = keys[0] || {};
			const keyName = firstKey.code || firstKey.name || '';
			const constraintName = keyName.includes(' ') ? `\`${keyName}\`` : keyName;

			return getInlineForeignKeyStatement({
				constraintName,
				childColumns: keys.flatMap(item => item.childColumns),
				parentTableName: firstKey.parentTableName,
				parentColumns: keys.flatMap(item => item.parentColumns),
				disableNoValidate: keys.some(item => item?.disableNoValidate),
				isActivated: keys.every(item => item.isActivated),
				isChildTableActivated: keys.every(item => item.isChildTableActivated),
			});
		})
		.join(',\n');
};

const isTableActivated = (tableData, jsonSchema) => (tableData.isActivated ?? jsonSchema?.isActivated) !== false;

const getForeignColumnsPaths = (columnsPaths = []) => {
	if (columnsPaths.length > 0 && Array.isArray(columnsPaths[0])) {
		return columnsPaths;
	}
	return columnsPaths.length ? [columnsPaths] : [];
};

const getForeignColumns = (columnsPaths, idToNameHashTable, jsonSchema) =>
	getForeignColumnsPaths(columnsPaths).map(path => ({
		name: schemaHelper.getNameByPath(idToNameHashTable, (path || []).slice(1)),
		isActivated: schemaHelper.getItemByPath((path || []).slice(1), jsonSchema)?.isActivated !== false,
	}));

module.exports = {
	getForeignKeyHashTable,
	getForeignKeyStatementsByHashItem,
	getForeignKeyConstraint,
	getForeignKeyColumnsStatements,
	getInlineForeignKeyStatement,
};
