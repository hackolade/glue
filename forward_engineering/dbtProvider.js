/**
 * @typedef {import('./types').ColumnDefinition} ColumnDefinition
 * @typedef {import('./types').JsonSchema} JsonSchema
 * @typedef {import('./types').ConstraintDto} ConstraintDto
 */

const { getTypeByProperty } = require('./helpers/columnHelper');
const { getColumnConstraints } = require('./helpers/keyHelper');

class DbtProvider {
	/**
	 * @returns {DbtProvider}
	 */
	static createDbtProvider() {
		return new DbtProvider();
	}

	/**
	 * @param {{ columnDefinition: ColumnDefinition }}
	 * @returns {string}
	 */
	decorateType({ columnDefinition }) {
		const type = getTypeByProperty(columnDefinition);
		const isComplexType = /^(array|struct)/i.test(type);

		return isComplexType ? type.replace(/<[\s\S]+>$/, '<>') : type;
	}

	/**
	 * @param {{ columnDefinition: ColumnDefinition }}
	 * @returns {ConstraintDto[]}
	 */
	getColumnConstraints({ columnDefinition }) {
		return getColumnConstraints({ columnDefinition });
	}
}

module.exports = DbtProvider;
