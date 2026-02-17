import { existsSync, statSync } from 'node:fs';
import Table from 'cli-table3';
import type { Command } from 'commander';
import { getCAPublicKey } from '../core/ca';
import { isInitialized, loadConfig, paths } from '../core/config';
import { getCredentialCounts } from '../core/database';
import { colors, icons } from '../utils/colors';
import { handleError } from '../utils/errors';
import { logger } from '../utils/logger';

export function statusCommand(program: Command): void {
	program
		.command('status')
		.description('Show VaultMark status and CA information')
		.action(async () => {
			try {
				if (!isInitialized()) {
					logger.warning('VaultMark is not initialized');
					console.log(colors.muted('  Run: vaultmark init'));
					return;
				}

				const config = loadConfig();
				const publicKey = getCAPublicKey();
				const counts = getCredentialCounts();

				logger.blank();
				logger.secure('VaultMark Status');
				logger.blank();

				// CA Info
				const caTable = new Table({
					style: { head: [], border: [] },
					chars: {
						top: '',
						'top-mid': '',
						'top-left': '',
						'top-right': '',
						bottom: '',
						'bottom-mid': '',
						'bottom-left': '',
						'bottom-right': '',
						left: '  ',
						'left-mid': '',
						mid: '',
						'mid-mid': '',
						right: '',
						'right-mid': '',
						middle: ' ',
					},
				});

				caTable.push(
					[colors.muted('Key ID'), config.keyId],
					[colors.muted('Created'), config.createdAt || 'unknown'],
					[colors.muted('Max TTL'), config.maxTTL],
					[colors.muted('CA Public Key'), truncateKey(publicKey)],
					[colors.muted('Storage'), paths.root],
					[colors.muted('KRL'), existsSync(paths.krl) ? 'Active' : 'None']
				);

				console.log(caTable.toString());
				logger.blank();

				// Credentials summary
				console.log(`  ${icons.shield} ${colors.highlight('Credentials')}`);
				console.log(
					`    ${colors.active(`${counts.active} active`)}  ${colors.muted(`${counts.expired} expired`)}  ${colors.revoked(`${counts.revoked} revoked`)}`
				);

				// DB size
				if (existsSync(paths.db)) {
					const dbSize = statSync(paths.db).size;
					console.log(`    ${colors.muted(`Database: ${formatSize(dbSize)}`)}`);
				}

				logger.blank();
			} catch (error) {
				handleError(error);
			}
		});
}

function truncateKey(key: string): string {
	if (key.length <= 60) return key;
	return `${key.slice(0, 30)}...${key.slice(-20)}`;
}

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes}B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
