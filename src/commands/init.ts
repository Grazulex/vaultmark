import type { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import { initCA } from '../core/ca';
import { ensureDirs, isInitialized, loadConfig, paths, saveConfig } from '../core/config';
import { insertAudit } from '../core/database';
import { initKRL } from '../core/krl';
import { colors, icons } from '../utils/colors';
import { CAError, handleError } from '../utils/errors';
import { logger } from '../utils/logger';
import { formatTimestamp } from '../utils/time';

export function initCommand(program: Command): void {
	program
		.command('init')
		.description('Initialize VaultMark Certificate Authority')
		.option('--passphrase <passphrase>', 'CA passphrase (prompted if not provided)')
		.option('--key-id <id>', 'CA key identifier', 'vaultmark-ca')
		.option('-f, --force', 'Force reinitialize (invalidates all certificates)')
		.option('-y, --yes', 'Skip confirmations')
		.action(async (opts) => {
			try {
				if (isInitialized() && !opts.force) {
					throw new CAError('VaultMark is already initialized', [
						'Use --force to reinitialize',
						'WARNING: This will invalidate ALL existing certificates',
					]);
				}

				if (isInitialized() && opts.force && !opts.yes) {
					const { confirm } = await inquirer.prompt([
						{
							type: 'confirm',
							name: 'confirm',
							message: colors.warning(
								'This will reinitialize the CA and invalidate ALL existing certificates. Continue?'
							),
							default: false,
						},
					]);
					if (!confirm) {
						logger.info('Cancelled');
						return;
					}
				}

				let passphrase = opts.passphrase;
				if (!passphrase) {
					const answers = await inquirer.prompt([
						{
							type: 'password',
							name: 'passphrase',
							message: 'Enter CA passphrase:',
							mask: '*',
							validate: (input: string) =>
								input.length >= 8 || 'Passphrase must be at least 8 characters',
						},
						{
							type: 'password',
							name: 'confirm',
							message: 'Confirm CA passphrase:',
							mask: '*',
						},
					]);

					if (answers.passphrase !== answers.confirm) {
						throw new CAError('Passphrases do not match');
					}
					passphrase = answers.passphrase;
				}

				ensureDirs();

				const spinner = ora('Generating CA keypair...').start();

				// If force reinit, remove existing CA files
				if (opts.force && isInitialized()) {
					const { rmSync } = await import('node:fs');
					rmSync(paths.caKey, { force: true });
					rmSync(paths.caPub, { force: true });
					rmSync(paths.caSalt, { force: true });
				}

				const { publicKey } = initCA(passphrase, opts.keyId);
				spinner.succeed('CA keypair generated');

				// Save config
				const config = loadConfig();
				config.keyId = opts.keyId;
				config.createdAt = formatTimestamp();
				saveConfig(config);

				// Init KRL
				initKRL();

				// Audit
				insertAudit('init', null, `CA initialized with key-id: ${opts.keyId}`);

				logger.blank();
				logger.secure('VaultMark initialized successfully');
				logger.blank();
				console.log(`  ${colors.muted('CA Public Key:')} ${paths.caPub}`);
				console.log(`  ${colors.muted('Key ID:')}        ${opts.keyId}`);
				console.log(`  ${colors.muted('Storage:')}       ${paths.root}`);
				logger.blank();
				console.log(
					colors.muted(`  ${icons.info} To configure a host: vaultmark setup-host <host>`)
				);
				logger.blank();
			} catch (error) {
				handleError(error);
			}
		});
}
