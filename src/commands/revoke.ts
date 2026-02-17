import type { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import { ensureInitialized } from '../core/config';
import { revokeCredential } from '../core/credential';
import { getCredential } from '../core/database';
import { colors, icons } from '../utils/colors';
import { handleError } from '../utils/errors';
import { logger } from '../utils/logger';

export function revokeCommand(program: Command): void {
	program
		.command('revoke <id>')
		.description('Revoke a credential immediately')
		.option('-y, --yes', 'Skip confirmation')
		.action(async (id, opts) => {
			try {
				ensureInitialized();

				const cred = getCredential(id);
				if (!cred) {
					logger.error(`Credential "${id}" not found`);
					return;
				}

				if (!opts.yes) {
					console.log();
					console.log(`  ${colors.muted('ID')}      ${cred.id}`);
					console.log(`  ${colors.muted('Type')}    ${cred.type}`);
					console.log(`  ${colors.muted('Label')}   ${cred.label}`);
					if (cred.host) {
						console.log(`  ${colors.muted('Host')}    ${cred.user}@${cred.host}`);
					}
					console.log();

					const { confirm } = await inquirer.prompt([
						{
							type: 'confirm',
							name: 'confirm',
							message: colors.warning('Revoke this credential?'),
							default: false,
						},
					]);

					if (!confirm) {
						logger.info('Cancelled');
						return;
					}
				}

				const spinner = ora('Revoking credential...').start();
				const revoked = revokeCredential(id);
				spinner.succeed('Credential revoked');

				logger.blank();
				console.log(`  ${icons.skull} ${colors.revoked(`Credential ${id} has been revoked`)}`);
				console.log(`  ${colors.muted('Certificate files have been destroyed')}`);
				console.log(`  ${colors.muted('KRL updated')}`);
				logger.blank();
			} catch (error) {
				handleError(error);
			}
		});
}
