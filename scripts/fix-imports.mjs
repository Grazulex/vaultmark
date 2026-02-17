import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const distDir = './dist';

async function exists(path) {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
}

async function fixImports(dir) {
	const entries = await readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = join(dir, entry.name);

		if (entry.isDirectory()) {
			await fixImports(fullPath);
		} else if (entry.name.endsWith('.js')) {
			let content = await readFile(fullPath, 'utf8');
			const fileDir = dirname(fullPath);

			// Fix relative imports to add .js extension
			content = await replaceAsync(
				content,
				/(from\s+['"])(\.\.?\/[^'"]+)(?<!\.js)(['"])/g,
				async (match, prefix, importPath, suffix) => {
					const resolved = resolve(fileDir, importPath);
					// Check if it's a directory with index.js
					if (await exists(join(resolved, 'index.js'))) {
						return `${prefix}${importPath}/index.js${suffix}`;
					}
					return `${prefix}${importPath}.js${suffix}`;
				}
			);

			// Fix dynamic imports
			content = await replaceAsync(
				content,
				/(import\s*\(\s*['"])(\.\.?\/[^'"]+)(?<!\.js)(['"]\s*\))/g,
				async (match, prefix, importPath, suffix) => {
					const resolved = resolve(fileDir, importPath);
					if (await exists(join(resolved, 'index.js'))) {
						return `${prefix}${importPath}/index.js${suffix}`;
					}
					return `${prefix}${importPath}.js${suffix}`;
				}
			);

			await writeFile(fullPath, content);
		}
	}
}

async function replaceAsync(str, regex, asyncFn) {
	const matches = [];
	str.replace(regex, (...args) => {
		matches.push({ args, index: args[args.length - 2] });
	});

	let result = str;
	// Process in reverse order to preserve indices
	for (let i = matches.length - 1; i >= 0; i--) {
		const { args } = matches[i];
		const replacement = await asyncFn(...args);
		const matchStr = args[0];
		const matchIndex = args[args.length - 2];
		result = result.slice(0, matchIndex) + replacement + result.slice(matchIndex + matchStr.length);
	}
	return result;
}

console.log('Fixing imports in dist...');
await fixImports(distDir);
console.log('Done!');
