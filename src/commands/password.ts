import type { Command } from 'commander';
import ora from 'ora';
import { ensureInitialized, loadConfig } from '../core/config';
import { createEphemeralPassword } from '../core/credential';
import { getAvailableCharsets } from '../core/password-generator';
import { colors, icons } from '../utils/colors';
import { handleError } from '../utils/errors';
import { logger } from '../utils/logger';
import { formatDuration, parseTTL } from '../utils/time';

export function passwordCommand(program: Command): void {
	program
		.command('password [label]')
		.description('Generate an ephemeral password')
		.option('-t, --ttl <ttl>', 'Time to live (e.g., 10m, 1h)')
		.option('-l, --length <length>', 'Password length', '32')
		.option('--charset <charset>', 'Character set (alphanumeric, special, hex, alpha, numeric)')
		.option('--copy', 'Copy to clipboard')
		.action(async (label, opts) => {
			try {
				ensureInitialized();

				const config = loadConfig();
				const ttl = opts.ttl || config.defaults.ttl;
				const length = Number.parseInt(opts.length, 10) || config.defaults.passwordLength;
				const charset = opts.charset || config.defaults.passwordCharset;

				// Validate
				parseTTL(ttl);
				if (length < 8 || length > 256) {
					logger.error('Password length must be between 8 and 256');
					return;
				}
				if (!getAvailableCharsets().includes(charset)) {
					logger.error(`Invalid charset. Available: ${getAvailableCharsets().join(', ')}`);
					return;
				}

				const spinner = ora('Generating ephemeral password...').start();

				const { credential, password } = createEphemeralPassword({
					label: label || 'unnamed',
					ttl,
					length,
					charset,
					copy: opts.copy || false,
				});

				spinner.succeed('Password generated');

				// Copy to clipboard if requested
				if (opts.copy) {
					try {
						const { execSync } = await import('node:child_process');
						execSync(
							`echo -n "${password}" | xclip -selection clipboard 2>/dev/null || echo -n "${password}" | pbcopy 2>/dev/null`,
							{ stdio: 'pipe' }
						);
						logger.success('Copied to clipboard');
					} catch {
						logger.warning('Could not copy to clipboard');
					}
				}

				logger.blank();
				logger.secure(`Ephemeral Password: ${label || 'unnamed'}`);
				logger.blank();

				console.log(`  ${colors.muted('ID')}        ${credential.id}`);
				console.log(`  ${colors.muted('TTL')}       ${formatDuration(credential.ttlSeconds)}`);
				console.log(`  ${colors.muted('Expires')}   ${credential.expiresAt}`);
				console.log(`  ${colors.muted('Charset')}   ${charset}`);
				console.log(`  ${colors.muted('Length')}    ${length}`);
				logger.blank();

				console.log(`  ${icons.key} ${colors.highlight(password)}`);
				logger.blank();

				console.log(colors.warning(`  ${icons.warning} This password will NOT be shown again`));
				console.log(colors.muted(`  ${icons.info} Only a SHA-256 hash is stored for audit`));
				logger.blank();
			} catch (error) {
				handleError(error);
			}
		});
}
