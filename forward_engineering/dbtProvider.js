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
	 * @param {{ type: string; columnDefinition: ColumnDefinition }}
	 * @returns {string}
	 */
	decorateType({ type, columnDefinition }) {
		return getTypeByProperty(columnDefinition);
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
