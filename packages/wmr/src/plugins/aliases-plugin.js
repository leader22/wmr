import { debug, formatResolved } from '../lib/output-utils.js';
import path from 'path';

/**
 * Package.json "aliases" field: {"a":"b"}
 * @param {object} options
 * @param {Record<string,string>} options.aliases
 * @param {string} options.cwd
 * @returns {import('rollup').Plugin}
 */
export default function aliasesPlugin({ aliases, cwd }) {
	const log = debug('aliases');

	return {
		name: 'aliases',
		async resolveId(id, importer) {
			if (typeof id !== 'string' || id.startsWith('\0')) {
				return;
			}

			let aliased = null;

			if (/^\.\.?\//.test(id)) {
				// TODO: Do we need to support this?
				if (!importer) return;
				const newId = path.resolve(path.dirname(importer ? importer : cwd), id);

				for (const name in aliases) {
					const dir = aliases[name];
					if (path.isAbsolute(dir)) {
						const rel = path.relative(dir, newId);
						if (!rel.startsWith('..')) {
							aliased = path.join(dir, rel);
						}
					}
				}
			} else {
				let partial = null;
				for (let i in aliases) {
					// Find an exact match
					if (id === i) {
						aliased = aliases[i];
						break;
					}

					// Fall back to a partial match if any
					if (!path.isAbsolute(id) && !path.relative(i, id).startsWith('..')) {
						partial = aliases[i] + id.substring(i.length);
						break;
					}
				}

				if (aliased === null && partial) {
					aliased = partial;
				}
			}

			// We had no exact match, use partial one

			if (aliased == null || aliased === id) {
				return;
			}
			// now allow other resolvers to handle the aliased version
			// (this is important since they may mark as external!)
			const resolved = await this.resolve(aliased, importer, { skipSelf: true });
			log(formatResolved(id, resolved));
			return resolved;
		}
	};
}
