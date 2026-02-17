import type { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import { ensureInitialized, loadConfig } from '../core/config';
import { grantSSHAccess } from '../core/credential';
import { colors, icons } from '../utils/colors';
import { handleError } from '../utils/errors';
import { logger } from '../utils/logger';
import { formatDuration, parseTTL } from '../utils/time';

export function grantCommand(program: Command): void {
	program
		.command('grant <host>')
		.description('Create an ephemeral SSH certificate')
		.requiredOption('-u, --user <user>', 'Remote username')
		.option('-t, --ttl <ttl>', 'Time to live (e.g., 30m, 1h, 4h)')
		.option('--force-command <command>', 'Force a specific command on the remote')
		.option('--identity <name>', 'Certificate identity string')
		.option('-o, --output <path>', 'Output directory for certificate files')
		.action(async (host, opts) => {
			try {
				ensureInitialized();

				const config = loadConfig();
				const ttl = opts.ttl || config.defaults.ttl;

				// Validate TTL
				parseTTL(ttl);

				// Prompt for passphrase
				const { passphrase } = await inquirer.prompt([
					{
						type: 'password',
						name: 'passphrase',
						message: 'CA passphrase:',
						mask: '*',
					},
				]);

				const spinner = ora('Generating ephemeral certificate...').start();

				const { credential, sshCommand } = grantSSHAccess(passphrase, {
					host,
					user: opts.user,
					ttl,
					forceCommand: opts.forceCommand,
					identity: opts.identity,
					output: opts.output,
				});

				spinner.succeed('Certificate generated');

				logger.blank();
				logger.secure(`Access granted: ${opts.user}@${host}`);
				logger.blank();

				console.log(`  ${colors.muted('ID')}          ${credential.id}`);
				console.log(`  ${colors.muted('TTL')}         ${formatDuration(credential.ttlSeconds)}`);
				console.log(`  ${colors.muted('Expires')}     ${credential.expiresAt}`);
				console.log(`  ${colors.muted('Serial')}      ${credential.serial}`);
				if (opts.forceCommand) {
					console.log(`  ${colors.muted('Command')}     ${opts.forceCommand}`);
				}

				logger.blank();
				console.log(`  ${icons.arrow} ${colors.highlight('Connect with:')}`);
				console.log(`  ${colors.accent(sshCommand)}`);
				logger.blank();

				console.log(
					colors.muted(
						`  ${icons.timer} This certificate will auto-expire in ${formatDuration(credential.ttlSeconds)}`
					)
				);
				console.log(
					colors.muted(`  ${icons.info} Revoke early: vaultmark revoke ${credential.id}`)
				);
				logger.blank();
			} catch (error) {
				handleError(error);
			}
		});
}
