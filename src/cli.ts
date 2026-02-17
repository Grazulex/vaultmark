#!/usr/bin/env node

import { createRequire } from 'node:module';
import chalk from 'chalk';
import { program } from 'commander';
import {
	auditCommand,
	cleanupCommand,
	grantCommand,
	initCommand,
	listCommand,
	passwordCommand,
	revokeCommand,
	setupHostCommand,
	statusCommand,
} from './commands';
import { handleError } from './utils/errors';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');
const VERSION = packageJson.version;

const banner = `
${chalk.hex('#00BFA5').bold('\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510')}
${chalk.hex('#00BFA5').bold('\u2502')}  ${chalk.hex('#26A69A').bold('\uD83D\uDD12 VAULTMARK')}                        ${chalk.hex('#00BFA5').bold('\u2502')}
${chalk.hex('#00BFA5').bold('\u2502')}  ${chalk.gray('Ephemeral credentials, zero trust')}  ${chalk.hex('#00BFA5').bold('\u2502')}
${chalk.hex('#00BFA5').bold('\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518')}
`;

function showBanner(): void {
	console.log(banner);
}

program
	.name('vaultmark')
	.description('Ephemeral credential manager for secure AI-assisted development')
	.version(VERSION, '-v, --version', 'Show version information')
	.action(() => {
		showBanner();
		program.help();
	});

// Register commands
initCommand(program);
statusCommand(program);
grantCommand(program);
revokeCommand(program);
listCommand(program);
passwordCommand(program);
setupHostCommand(program);
cleanupCommand(program);
auditCommand(program);

// Global error handling
program.exitOverride((err) => {
	if (err.code === 'commander.helpDisplayed' || err.code === 'commander.version') {
		process.exit(0);
	}
	handleError(err);
});

// Parse arguments
try {
	program.parse();
} catch (error) {
	handleError(error);
}
