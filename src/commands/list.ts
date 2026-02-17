import Table from 'cli-table3';
import type { Command } from 'commander';
import { ensureInitialized } from '../core/config';
import { cleanupExpired } from '../core/credential';
import { listCredentials } from '../core/database';
import type { CredentialStatus, CredentialType } from '../types/credential';
import { colorizeStatus, colorizeTTL, colors, icons } from '../utils/colors';
import { handleError } from '../utils/errors';
import { logger } from '../utils/logger';
import { remainingSeconds } from '../utils/time';

export function listCommand(program: Command): void {
	program
		.command('list')
		.description('List credentials')
		.option('--type <type>', 'Filter by type (ssh-cert, password)')
		.option('--status <status>', 'Filter by status (active, expired, revoked)')
		.option('-a, --all', 'Show all credentials including expired/revoked')
		.option('--host <host>', 'Filter by host')
		.action(async (opts) => {
			try {
				ensureInitialized();

				// Auto-cleanup
				cleanupExpired();

				const credentials = listCredentials({
					type: opts.type as CredentialType | undefined,
					status: opts.status as CredentialStatus | undefined,
					host: opts.host,
					includeAll: opts.all,
				});

				if (credentials.length === 0) {
					logger.info('No credentials found');
					return;
				}

				logger.blank();
				console.log(`  ${icons.shield} ${colors.highlight('Credentials')} (${credentials.length})`);
				logger.blank();

				const table = new Table({
					head: ['ID', 'Type', 'Label', 'Host', 'Status', 'TTL Remaining'],
					style: { head: ['cyan'] },
				});

				for (const cred of credentials) {
					const remaining = remainingSeconds(cred.expiresAt) * 1000;
					const host = cred.host ? `${cred.user}@${cred.host}` : '-';

					table.push([
						cred.id,
						cred.type,
						cred.label,
						host,
						colorizeStatus(cred.status),
						cred.status === 'active' ? colorizeTTL(remaining) : colors.muted(cred.status),
					]);
				}

				console.log(table.toString());
				logger.blank();
			} catch (error) {
				handleError(error);
			}
		});
}
