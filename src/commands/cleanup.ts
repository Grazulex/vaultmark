import type { Command } from 'commander';
import ora from 'ora';
import { ensureInitialized } from '../core/config';
import { cleanupExpired } from '../core/credential';
import { colors, icons } from '../utils/colors';
import { handleError } from '../utils/errors';
import { logger } from '../utils/logger';

export function cleanupCommand(program: Command): void {
	program
		.command('cleanup')
		.description('Force cleanup of expired credentials')
		.action(async () => {
			try {
				ensureInitialized();

				const spinner = ora('Cleaning up expired credentials...').start();
				const count = cleanupExpired();

				if (count > 0) {
					spinner.succeed(`Cleaned up ${count} expired credential(s)`);
				} else {
					spinner.succeed('No expired credentials to clean up');
				}

				logger.blank();
				console.log(`  ${icons.broom} ${colors.muted(`${count} credential(s) cleaned`)}`);
				logger.blank();
			} catch (error) {
				handleError(error);
			}
		});
}
