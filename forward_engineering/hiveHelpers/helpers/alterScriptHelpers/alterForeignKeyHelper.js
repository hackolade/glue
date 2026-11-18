const { getFullEntityName } = require('./generalHelper');
const { prepareName, commentDeactivatedStatements } = require('../generalHelper');
const { getForeignKeyColumnsStatements } = require('../foreignKeyHelper');

const templates = require('./config/templates');
const { getItems } = require('./common');
const { CONSTRAINT_POSTFIX } = require('../constants');

const getRelationshipName = (relationship, parentTableName, childTableName) => {
	const compMod = relationship.role.compMod;
	const name = compMod.code?.new || compMod.name?.new || relationship.role.code || relationship.role.name;
	if (name) {
		return prepareName(name);
	}
	return prepareName([parentTableName, childTableName, CONSTRAINT_POSTFIX.foreignKey].filter(Boolean).join('_'));
};

const getFullParentTableName = relationship => {
	const compMod = relationship.role.compMod;

	const parentDBName = prepareName(compMod.parent.bucket.name);
	const parentEntityName = prepareName(compMod.parent.collection.name);

	return getFullEntityName(parentDBName, parentEntityName);
};

const getFullChildTableName = relationship => {
	const compMod = relationship.role.compMod;

	const childDBName = prepareName(compMod.child.bucket.name);
	const childEntityName = prepareName(compMod.child.collection.name);
	return getFullEntityName(childDBName, childEntityName);
};

const isRelationshipActivated = relationship =>
	(relationship.role?.compMod?.isActivated?.new ?? relationship.role?.isActivated) !== false;

const isRelatedTableActivated = ({ bucket, collection } = {}) =>
	bucket?.isActivated !== false && collection?.isActivated !== false;

const areFkFieldsActivated = fields => (fields || []).every(field => field?.isActivated !== false);

const getAddSingleForeignKeyScript = provider => relationship => {
	const compMod = relationship.role.compMod;
	const parentTableName = getFullParentTableName(relationship);
	const childTableName = getFullChildTableName(relationship);

	const constraintName = getRelationshipName(relationship, parentTableName, childTableName);
	const prepareColumns = fields => fields.map(field => ({ ...field, name: prepareName(field.name) }));
	const { childColumns, parentColumns, isActivated } = getForeignKeyColumnsStatements({
		childColumns: prepareColumns(compMod.child.collection.fkFields),
		parentColumns: prepareColumns(compMod.parent.collection.fkFields),
		isActivated:
			isRelationshipActivated(relationship) &&
			isRelatedTableActivated(compMod.parent) &&
			isRelatedTableActivated(compMod.child) &&
			areFkFieldsActivated(compMod.parent?.collection?.fkFields) &&
			areFkFieldsActivated(compMod.child?.collection?.fkFields),
	});
	const disableNoValidate = relationship.role?.compMod?.customProperties?.new?.disableNoValidate;
	const disableNoValidateClause = disableNoValidate ? ' DISABLE NOVALIDATE' : '';

	const script = provider.assignTemplates(templates.addFkConstraint, {
		childTableName,
		constraintName,
		childColumns,
		parentTableName,
		parentColumns,
		disableNoValidate: disableNoValidateClause,
	});

	return { script, isActivated };
};

const canRelationshipBeAdded = relationship => {
	const compMod = relationship.role.compMod;
	if (!compMod) {
		return false;
	}
	return [
		compMod.parent?.bucket,
		compMod.parent?.collection,
		compMod.parent?.collection?.fkFields?.length,
		compMod.child?.bucket,
		compMod.child?.collection,
		compMod.child?.collection?.fkFields?.length,
	].every(Boolean);
};

const getAddForeignKeyScript = provider => relationship => {
	const { script, isActivated } = getAddSingleForeignKeyScript(provider)(relationship);

	return commentDeactivatedStatements(script, isActivated);
};

const isDeleteForeignKeyScriptActivated = relationship => {
	const compMod = relationship.role.compMod;

	return (
		isRelationshipActivated(relationship) &&
		isRelatedTableActivated(compMod.parent) &&
		isRelatedTableActivated(compMod.child) &&
		areFkFieldsActivated(compMod.parent?.collection?.fkFields) &&
		areFkFieldsActivated(compMod.child?.collection?.fkFields)
	);
};

const getDeleteSingleForeignKeyScript = provider => relationship => {
	const compMod = relationship.role.compMod;
	const tableName = getFullChildTableName(relationship);
	const relationshipName = compMod.code?.old || compMod.name?.old || getRelationshipName(relationship) || '';
	const constraintName = prepareName(relationshipName);

	return provider.assignTemplates(templates.dropConstraint, {
		tableName,
		constraintName,
	});
};

const canRelationshipBeDeleted = relationship => {
	const compMod = relationship.role.compMod;
	if (!compMod) {
		return false;
	}
	return [
		compMod.code?.old || compMod.name?.old || getRelationshipName(relationship),
		compMod.child?.bucket,
		compMod.child?.collection,
	].every(Boolean);
};

const getDeleteForeignKeyScripts = provider => deletedRelationships => {
	return deletedRelationships
		.filter(relationship => canRelationshipBeDeleted(relationship))
		.map(relationship => {
			const script = getDeleteSingleForeignKeyScript(provider)(relationship);

			return commentDeactivatedStatements(script, isDeleteForeignKeyScriptActivated(relationship));
		});
};

const getModifyForeignKeyScript = provider => relationship => {
	const deleteScript = getDeleteSingleForeignKeyScript(provider)(relationship);
	const { script: addScript, isActivated: isAddScriptActivated } =
		getAddSingleForeignKeyScript(provider)(relationship);
	const isActivated = isAddScriptActivated && isDeleteForeignKeyScriptActivated(relationship);

	return [deleteScript, addScript].map(script => commentDeactivatedStatements(script, isActivated));
};

const getAlterForeignKeyScripts = ({ schema, provider, currentSchemaName, ignoreRelationshipIDs = [] }) => {
	const generateAddFkScripts = (addedRelationships, getScript) => {
		return addedRelationships.filter(relationship => canRelationshipBeAdded(relationship)).flatMap(getScript);
	};

	const generateModifyFkScripts = (modifiedRelationships, getScript) => {
		return modifiedRelationships
			.filter(relationship => canRelationshipBeAdded(relationship) && canRelationshipBeDeleted(relationship))
			.flatMap(getScript);
	};

	const deletedRelationships = getItems(schema, 'relationships', 'deleted').filter(
		relationship => relationship.role?.compMod?.deleted && !ignoreRelationshipIDs.includes(relationship?.role?.id),
	);
	const addedRelationships = getItems(schema, 'relationships', 'added').filter(
		relationship => relationship.role?.compMod?.created && !ignoreRelationshipIDs.includes(relationship?.role?.id),
	);
	const modifiedRelationships = getItems(schema, 'relationships', 'modified');

	const deleteFkScripts = getDeleteForeignKeyScripts(provider)(deletedRelationships);
	const addFkScripts = generateAddFkScripts(addedRelationships, getAddForeignKeyScript(provider));
	const modifiedFkScripts = generateModifyFkScripts(modifiedRelationships, getModifyForeignKeyScript(provider));
	return { deleteFkScripts, addFkScripts, modifiedFkScripts };
};

module.exports = {
	getAlterForeignKeyScripts,
	isRelationshipActivated,
	isRelatedTableActivated,
};
