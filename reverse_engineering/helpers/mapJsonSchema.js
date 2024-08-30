const { isEmpty, isPlainObject, has, partial } = require('lodash');

const mapJsonSchema = (jsonSchema, parentJsonSchema, callback, key) => {
	const mapProperties = (properties, mapper) =>
		Object.keys(properties).reduce((newProperties, propertyName) => {
			const schema = mapper(properties[propertyName], propertyName);

			if (isEmpty(schema)) {
				return newProperties;
			}

			return { ...newProperties, [propertyName]: schema };
		}, {});
	const mapItems = (items, mapper) => {
		if (Array.isArray(items)) {
			return items.map((jsonSchema, i) => mapper(jsonSchema, i)).filter(item => !isEmpty(item));
		} else if (isPlainObject(items)) {
			return mapper(items, 0);
		} else {
			return items;
		}
	};
	const mapChoices = (parentJsonSchema, subSchemas, mapper) => {
		let subSchemasUpdated = mapItems(subSchemas, mapper);

		if (!Array.isArray(subSchemasUpdated)) {
			return subSchemasUpdated;
		}

		subSchemasUpdated = subSchemasUpdated.filter(subSchema => subSchema.properties);

		if (subSchemasUpdated.length > 1) {
			return subSchemasUpdated;
		}

		const subSchema = subSchemasUpdated[0];

		if (!has(subSchema, 'properties')) {
			return subSchemasUpdated;
		}

		if (!has(parentJsonSchema, 'properties')) {
			parentJsonSchema.properties = {};
		}

		Object.keys(subSchema.properties).forEach(key => {
			if (has(parentJsonSchema, 'properties.' + key)) {
				return;
			}

			parentJsonSchema.properties[key] = subSchema.properties[key];
		});

		return [];
	};
	const applyTo = (properties, jsonSchema, mapper) => {
		return properties.reduce((jsonSchema, propertyName) => {
			if (!jsonSchema[propertyName]) {
				return jsonSchema;
			}

			const schema = mapper(jsonSchema[propertyName], propertyName);

			if (isEmpty(schema)) {
				const copySchema = Object.assign({}, jsonSchema);

				delete copySchema[propertyName];

				return copySchema;
			}

			return Object.assign({}, jsonSchema, {
				[propertyName]: schema,
			});
		}, jsonSchema);
	};
	if (!isPlainObject(jsonSchema)) {
		return jsonSchema;
	}
	const copyJsonSchema = Object.assign({}, jsonSchema);
	const mapper = partial(mapJsonSchema, partial.placeholder, copyJsonSchema, callback);
	const propertiesLike = ['properties', 'definitions', 'patternProperties'];
	const itemsLike = ['items', 'not'];
	const choices = ['oneOf', 'allOf', 'anyOf'];

	const jsonSchemaWithNewProperties = applyTo(
		propertiesLike,
		copyJsonSchema,
		partial(mapProperties, partial.placeholder, mapper),
	);
	const updatedItems = applyTo(
		itemsLike,
		jsonSchemaWithNewProperties,
		partial(mapItems, partial.placeholder, mapper),
	);
	const newJsonSchema = applyTo(
		choices,
		updatedItems,
		partial(mapChoices, updatedItems, partial.placeholder, mapper),
	);

	return callback(newJsonSchema, parentJsonSchema, key);
};

module.exports = mapJsonSchema;
