import type { Command } from 'commander';
import ora from 'ora';
import { getCAPublicKey } from '../core/ca';
import { ensureInitialized } from '../core/config';
import { insertAudit } from '../core/database';
import { setupHost } from '../core/ssh';
import { colors, icons } from '../utils/colors';
import { handleError } from '../utils/errors';
import { logger } from '../utils/logger';

export function setupHostCommand(program: Command): void {
	program
		.command('setup-host <host>')
		.description('Configure a remote host to trust the VaultMark CA')
		.option('-u, --user <user>', 'SSH username for setup', 'root')
		.option('-p, --port <port>', 'SSH port', '22')
		.option('-i, --identity <file>', 'SSH identity file for authentication')
		.option('--dry-run', 'Show commands without executing')
		.action(async (host, opts) => {
			try {
				ensureInitialized();

				if (opts.dryRun) {
					logger.info('Dry run mode - showing commands that would be executed:');
					logger.blank();

					const publicKey = getCAPublicKey();
					console.log(colors.muted('  # 1. Add CA public key to trusted keys'));
					console.log(`  echo '${publicKey}' | sudo tee -a /etc/ssh/trusted_ca_keys > /dev/null`);
					logger.blank();
					console.log(colors.muted('  # 2. Configure sshd'));
					console.log(
						"  echo 'TrustedUserCAKeys /etc/ssh/trusted_ca_keys' | sudo tee -a /etc/ssh/sshd_config > /dev/null"
					);
					logger.blank();
					console.log(colors.muted('  # 3. Reload SSH daemon'));
					console.log('  sudo systemctl reload sshd');
					logger.blank();
					return;
				}

				const spinner = ora(`Configuring ${host}...`).start();

				const result = await setupHost({
					host,
					user: opts.user,
					port: Number.parseInt(opts.port, 10),
					identityFile: opts.identity,
					dryRun: false,
				});

				if (result.success) {
					spinner.succeed(`Host ${host} configured`);
				} else {
					spinner.fail(`Host ${host} configuration failed`);
				}

				logger.blank();
				for (const step of result.steps) {
					const icon = step.success ? colors.success(icons.check) : colors.error(icons.cross);
					console.log(`  ${icon} ${step.description}`);
					if (step.error) {
						console.log(`    ${colors.error(step.error)}`);
					}
				}
				logger.blank();

				if (result.success) {
					insertAudit('setup-host', null, `Host ${host} configured for CA trust`);
					console.log(
						colors.muted(
							`  ${icons.info} You can now grant access with: vaultmark grant ${host} -u <user>`
						)
					);
				}

				logger.blank();
			} catch (error) {
				handleError(error);
			}
		});
}
