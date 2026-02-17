import Table from 'cli-table3';
import type { Command } from 'commander';
import { ensureInitialized } from '../core/config';
import { listAudit } from '../core/database';
import { colors, icons } from '../utils/colors';
import { handleError } from '../utils/errors';
import { logger } from '../utils/logger';

export function auditCommand(program: Command): void {
	program
		.command('audit')
		.description('Show audit log')
		.option('-n, --limit <limit>', 'Number of entries', '20')
		.option('--action <action>', 'Filter by action (grant, revoke, cleanup, init, password)')
		.option('--credential <id>', 'Filter by credential ID')
		.option('--since <date>', 'Show entries since date (ISO format)')
		.option('--json', 'Output as JSON')
		.action(async (opts) => {
			try {
				ensureInitialized();

				const entries = listAudit({
					limit: Number.parseInt(opts.limit, 10),
					action: opts.action,
					credentialId: opts.credential,
					since: opts.since,
				});

				if (entries.length === 0) {
					logger.info('No audit entries found');
					return;
				}

				if (opts.json) {
					console.log(JSON.stringify(entries, null, 2));
					return;
				}

				logger.blank();
				console.log(
					`  ${icons.certificate} ${colors.highlight('Audit Log')} (${entries.length} entries)`
				);
				logger.blank();

				const table = new Table({
					head: ['Timestamp', 'Action', 'Credential', 'Details'],
					style: { head: ['cyan'] },
					colWidths: [22, 14, 12, 50],
					wordWrap: true,
				});

				for (const entry of entries) {
					table.push([
						formatTimestampShort(entry.timestamp),
						colorizeAction(entry.action),
						entry.credentialId || '-',
						entry.details,
					]);
				}

				console.log(table.toString());
				logger.blank();
			} catch (error) {
				handleError(error);
			}
		});
}

function formatTimestampShort(ts: string): string {
	const d = new Date(ts);
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function pad(n: number): string {
	return String(n).padStart(2, '0');
}

function colorizeAction(action: string): string {
	const map: Record<string, (s: string) => string> = {
		grant: colors.active,
		revoke: colors.revoked,
		cleanup: colors.muted,
		init: colors.info,
		password: colors.accent,
		'setup-host': colors.info,
	};
	return (map[action] || colors.muted)(action);
}
