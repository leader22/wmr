import { promises as fs } from 'fs';
import * as path from 'path';

/**
 * Check if a file exists on disk
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
export async function fileExists(filePath) {
	try {
		if ((await fs.stat(filePath)).isFile()) {
			return true;
		}
	} catch (e) {}
	return false;
}

/**
 * Ensure that a file path resolves to a file in one of the allowed
 * directories to include files from.
 * @param {string} file Absolute path to file
 * @param {string} cwd
 * @param {Record<string, string>} aliases
 */
export function resolveFile(file, cwd, aliases) {
	file = !path.isAbsolute(file) ? path.resolve(cwd, file) : path.normalize(file);

	// Check if it is in cwd
	if (!path.relative(cwd, file).startsWith('..')) {
		return file;
	}

	for (let name in aliases) {
		const dir = aliases[name];
		if (path.isAbsolute(dir) && !path.relative(dir, file).startsWith('..')) {
			return file;
		}
	}

	const err = new Error(`Unable to resolve ${file}.`);
	// Used by top level error handler to rewrite it to a 404
	err.code = 'ENOENT';
	throw err;
}

/**
 * Normalize path to use unix style separators `/`
 * @param {string} file
 * @returns {string}
 */
export function normalizePath(file) {
	return file.split(path.sep).join(path.posix.sep);
}

/**
 * Serialize import specifier for clients.
 * @param {string} file
 * @param {string} cwd
 * @param {Record<string, string>} aliases
 * @param {object} [options]
 * @param {string} [options.importer]
 * @param {boolean} [options.forceAbsolute]
 */
export function serializeSpecifier(file, cwd, aliases, { importer, forceAbsolute } = {}) {
	// Resolve file path to an actual file and check if we're allowed
	// to load it, otherwise we throw. If we have permission we'll
	// continue.
	file = resolveFile(file, cwd, aliases);

	// Every file path sent to the client is relative to cwd.
	const relativeFile = normalizePath(path.relative(cwd, file));

	// Relative import specifiers must start with `./` or `../`. If the
	// resolved path doesn't begin with `../` then it was not resolved
	// outside of `cwd` and we can use `./` as a relative specifier.
	if (!importer && !relativeFile.startsWith('..')) {
		if (forceAbsolute) {
			return relativeFile.startsWith('/') ? relativeFile : '/' + relativeFile;
		}

		return './' + relativeFile;
	}

	// Check if the file matches an aliased one
	for (let name in aliases) {
		const dir = aliases[name];
		if (!path.isAbsolute(dir)) continue;

		const rel = path.relative(dir, file);
		if (!rel.startsWith('..')) {
			return `/${name}/${rel}`;
		}
	}

	throw new Error(`Unable to resolve file ${file}`);
}
