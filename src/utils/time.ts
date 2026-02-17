const TTL_REGEX = /^(\d+)(s|m|h|d)$/;

const MULTIPLIERS: Record<string, number> = {
	s: 1,
	m: 60,
	h: 3600,
	d: 86400,
};

export function parseTTL(ttl: string): number {
	const match = ttl.match(TTL_REGEX);
	if (!match) {
		throw new Error(`Invalid TTL format: "${ttl}". Use format like 30s, 5m, 1h, 1d`);
	}

	const value = Number.parseInt(match[1], 10);
	const unit = match[2];
	return value * MULTIPLIERS[unit];
}

export function formatDuration(seconds: number): string {
	if (seconds < 0) return 'expired';

	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = seconds % 60;

	const parts: string[] = [];
	if (hours > 0) parts.push(`${hours}h`);
	if (minutes > 0) parts.push(`${minutes}m`);
	if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

	return parts.join('');
}

export function isExpired(expiresAt: string): boolean {
	return new Date(expiresAt).getTime() <= Date.now();
}

export function remainingSeconds(expiresAt: string): number {
	return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

export function formatTimestamp(date: Date = new Date()): string {
	return date.toISOString();
}

export function formatRelative(expiresAt: string): string {
	const remaining = remainingSeconds(expiresAt);
	if (remaining <= 0) return 'expired';
	return `${formatDuration(remaining)} remaining`;
}
