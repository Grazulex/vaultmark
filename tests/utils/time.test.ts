import { describe, expect, it } from 'vitest';
import { formatDuration, isExpired, parseTTL, remainingSeconds } from '../../src/utils/time';

describe('parseTTL', () => {
	it('parses seconds', () => {
		expect(parseTTL('30s')).toBe(30);
		expect(parseTTL('1s')).toBe(1);
	});

	it('parses minutes', () => {
		expect(parseTTL('5m')).toBe(300);
		expect(parseTTL('30m')).toBe(1800);
	});

	it('parses hours', () => {
		expect(parseTTL('1h')).toBe(3600);
		expect(parseTTL('24h')).toBe(86400);
	});

	it('parses days', () => {
		expect(parseTTL('1d')).toBe(86400);
		expect(parseTTL('7d')).toBe(604800);
	});

	it('throws on invalid format', () => {
		expect(() => parseTTL('abc')).toThrow('Invalid TTL format');
		expect(() => parseTTL('10')).toThrow('Invalid TTL format');
		expect(() => parseTTL('10x')).toThrow('Invalid TTL format');
		expect(() => parseTTL('')).toThrow('Invalid TTL format');
	});
});

describe('formatDuration', () => {
	it('formats seconds', () => {
		expect(formatDuration(30)).toBe('30s');
		expect(formatDuration(0)).toBe('0s');
	});

	it('formats minutes', () => {
		expect(formatDuration(300)).toBe('5m');
		expect(formatDuration(90)).toBe('1m30s');
	});

	it('formats hours', () => {
		expect(formatDuration(3600)).toBe('1h');
		expect(formatDuration(3661)).toBe('1h1m1s');
	});

	it('handles negative values', () => {
		expect(formatDuration(-1)).toBe('expired');
	});
});

describe('isExpired', () => {
	it('returns true for past dates', () => {
		expect(isExpired('2020-01-01T00:00:00.000Z')).toBe(true);
	});

	it('returns false for future dates', () => {
		const future = new Date(Date.now() + 3600000).toISOString();
		expect(isExpired(future)).toBe(false);
	});
});

describe('remainingSeconds', () => {
	it('returns 0 for past dates', () => {
		expect(remainingSeconds('2020-01-01T00:00:00.000Z')).toBe(0);
	});

	it('returns positive for future dates', () => {
		const future = new Date(Date.now() + 60000).toISOString();
		expect(remainingSeconds(future)).toBeGreaterThan(0);
	});
});
