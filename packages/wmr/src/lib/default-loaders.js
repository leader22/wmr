import { IMPLICIT_URL } from '../plugins/url-plugin.js';
import { transformImports } from './transform-imports.js';
import { debug } from './output-utils.js';
import { promises as fs } from 'fs';
import path from 'path';
import * as kl from 'kolorist';

/**
 * Add default loaders to import specifiers if none are
 * present already.
 * @param {object} options
 * @param {string} options.cwd
 * @returns {import("wmr").Plugin}
 */
export function defaultLoaders({ cwd }) {
	const log = debug('wmr:defaults');

	return {
		name: 'default-loaders',
		async transform(code, id) {
			return await transformImports(code, id, {
				resolveId(specifier) {
					const hasPrefix = /^[-\w]+:/.test(specifier);

					if (!hasPrefix) {
						if (specifier.endsWith('.json')) {
							return `json:${specifier}`;
						} else if (IMPLICIT_URL.test(specifier)) {
							return `url:${specifier}`;
						}
					}
					return null;
				}
			});
		},
		// Default load hook for unprefixed files
		async load(id) {
			if (id.startsWith('\0') || id.lastIndexOf(':') !== -1) {
				return;
			}

			let file = id.split(path.posix.sep).join(path.sep);
			if (!path.isAbsolute(file)) {
				let original = file;
				file = path.resolve(cwd, file);
				log(`${kl.dim('load')} ${kl.cyan(original)} -> ${kl.dim(file)}`);

				// Aliases are already handled at this point, so restrict access to
				// files outside of `cwd` here.
				if (path.relative(cwd, file).startsWith('..')) {
					throw new Error(`Not allowed to load file ${file}`);
				}
			}

			return await fs.readFile(file, 'utf-8');
		}
	};
}
