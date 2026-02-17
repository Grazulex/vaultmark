import chalk from 'chalk';

export const colors = {
	// Semantic colors
	success: chalk.green,
	error: chalk.red,
	warning: chalk.yellow,
	info: chalk.cyan,
	muted: chalk.gray,
	highlight: chalk.bold.white,

	// Security theme
	secure: chalk.green.bold,
	danger: chalk.red.bold,
	expired: chalk.gray.strikethrough,
	active: chalk.green,
	revoked: chalk.red,

	// UI elements
	brand: chalk.hex('#00BFA5').bold,
	accent: chalk.hex('#26A69A'),
	dim: chalk.dim,
};

export const icons = {
	// Status
	success: '\u2714',
	error: '\u2716',
	warning: '\u26A0',
	info: '\u2139',

	// Security
	lock: '\uD83D\uDD12',
	unlock: '\uD83D\uDD13',
	key: '\uD83D\uDD11',
	shield: '\uD83D\uDEE1\uFE0F',
	certificate: '\uD83D\uDCDC',
	timer: '\u23F1\uFE0F',
	skull: '\uD83D\uDC80',
	broom: '\uD83E\uDDF9',

	// Actions
	arrow: '\u2192',
	bullet: '\u2022',
	check: '\u2713',
	cross: '\u2717',
	dot: '\u00B7',
};

export function colorizeStatus(status: string): string {
	const map: Record<string, (s: string) => string> = {
		active: colors.active,
		expired: colors.expired,
		revoked: colors.revoked,
	};
	return (map[status] || colors.muted)(status);
}

export function colorizeTTL(remainingMs: number): string {
	if (remainingMs <= 0) return colors.expired('expired');
	if (remainingMs < 5 * 60 * 1000) return colors.danger(formatMs(remainingMs));
	if (remainingMs < 30 * 60 * 1000) return colors.warning(formatMs(remainingMs));
	return colors.active(formatMs(remainingMs));
}

function formatMs(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	if (hours > 0) return `${hours}h${minutes % 60}m`;
	if (minutes > 0) return `${minutes}m${seconds % 60}s`;
	return `${seconds}s`;
}
