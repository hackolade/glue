'use strict';

const schemaHelper = require('./jsonSchemaHelper');
const { getName, getTab, commentDeactivatedStatements } = require('./generalHelper');
const { getItemByPath } = require('./jsonSchemaHelper');

const getIdToNameHashTable = (relationships, entities, jsonSchemas, internalDefinitions, otherDefinitions) => {
	const entitiesForHashing = entities.filter(entityId =>
		relationships.find(
			relationship => relationship.childCollection === entityId || relationship.parentCollection === entityId,
		),
	);

	return entitiesForHashing.reduce((hashTable, entityId) => {
		return Object.assign(
			{},
			hashTable,
			schemaHelper.getIdToNameHashTable([
				jsonSchemas[entityId],
				internalDefinitions[entityId],
				...otherDefinitions,
			]),
		);
	}, {});
};

const getForeignKeyHashTable = (
	relationships,
	entities,
	entityData,
	jsonSchemas,
	internalDefinitions,
	otherDefinitions,
	isContainerActivated,
) => {
	const idToNameHashTable = getIdToNameHashTable(
		relationships,
		entities,
		jsonSchemas,
		internalDefinitions,
		otherDefinitions,
	);

	return relationships.reduce((hashTable, relationship) => {
		if (!hashTable[relationship.childCollection]) {
			hashTable[relationship.childCollection] = {};
		}

		const constraintName = relationship.name;
		const parentTableData = getTab(0, entityData[relationship.parentCollection]);
		const parentTableName = getName(parentTableData);
		const childTableData = getTab(0, entityData[relationship.childCollection]);
		const childTableName = getName(childTableData);
		const groupKey = parentTableName + constraintName;
		const childField = getItemByPath(relationship.childField.slice(1), jsonSchemas[relationship.childCollection]);
		const parentField = getItemByPath(
			relationship.parentField.slice(1),
			jsonSchemas[relationship.parentCollection],
		);

		if (!hashTable[relationship.childCollection][groupKey]) {
			hashTable[relationship.childCollection][groupKey] = [];
		}
		const disableNoValidate = ((relationship || {}).customProperties || {}).disableNoValidate;

		hashTable[relationship.childCollection][groupKey].push({
			name: relationship.name,
			disableNoValidate: disableNoValidate,
			parentTableName: parentTableName,
			childTableName: childTableName,
			parentColumn: schemaHelper.getNameByPath(idToNameHashTable, (relationship.parentField || []).slice(1)),
			childColumn: schemaHelper.getNameByPath(idToNameHashTable, (relationship.childField || []).slice(1)),
			isActivated:
				isContainerActivated &&
				parentTableData?.isActivated &&
				childTableData?.isActivated &&
				childField?.isActivated &&
				parentField?.isActivated,
		});

		return hashTable;
	}, {});
};

const getForeignKeyStatementsByHashItem = hashItem => {
	return Object.keys(hashItem || {})
		.map(groupKey => {
			const keys = hashItem[groupKey];
			const constraintName = (keys[0] || {}).name;
			const parentTableName = (keys[0] || {}).parentTableName;
			const childTableName = (keys[0] || {}).childTableName;
			const disableNoValidate = keys.some(item => (item || {}).disableNoValidate);
			const childColumns = keys.map(item => item.childColumn).join(', ');
			const parentColumns = keys.map(item => item.parentColumn).join(', ');
			const isActivated = (keys[0] || {}).isActivated;

			const statement = `ALTER TABLE ${childTableName} ADD CONSTRAINT ${constraintName} FOREIGN KEY (${childColumns}) REFERENCES ${parentTableName}(${parentColumns}) ${disableNoValidate ? 'DISABLE NOVALIDATE' : ''};`;

			return commentDeactivatedStatements(statement, isActivated);
		})
		.join('\n');
};

module.exports = {
	getForeignKeyHashTable,
	getForeignKeyStatementsByHashItem,
};
