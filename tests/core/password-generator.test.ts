import { describe, expect, it } from 'vitest';
import {
	generatePassword,
	getAvailableCharsets,
	hashPassword,
} from '../../src/core/password-generator';

describe('password-generator', () => {
	describe('generatePassword', () => {
		it('generates password of correct length', () => {
			expect(generatePassword(16, 'alphanumeric')).toHaveLength(16);
			expect(generatePassword(32, 'alphanumeric')).toHaveLength(32);
			expect(generatePassword(64, 'alphanumeric')).toHaveLength(64);
		});

		it('generates unique passwords', () => {
			const p1 = generatePassword(32, 'alphanumeric');
			const p2 = generatePassword(32, 'alphanumeric');
			expect(p1).not.toBe(p2);
		});

		it('respects alphanumeric charset', () => {
			const pw = generatePassword(100, 'alphanumeric');
			expect(pw).toMatch(/^[a-zA-Z0-9]+$/);
		});

		it('respects hex charset', () => {
			const pw = generatePassword(100, 'hex');
			expect(pw).toMatch(/^[0-9a-f]+$/);
		});

		it('respects numeric charset', () => {
			const pw = generatePassword(100, 'numeric');
			expect(pw).toMatch(/^[0-9]+$/);
		});

		it('falls back to alphanumeric for unknown charset', () => {
			const pw = generatePassword(32, 'unknown');
			expect(pw).toHaveLength(32);
		});
	});

	describe('hashPassword', () => {
		it('produces consistent SHA-256 hash', () => {
			const hash1 = hashPassword('test');
			const hash2 = hashPassword('test');
			expect(hash1).toBe(hash2);
			expect(hash1).toHaveLength(64); // SHA-256 hex
		});

		it('different passwords produce different hashes', () => {
			expect(hashPassword('abc')).not.toBe(hashPassword('def'));
		});
	});

	describe('getAvailableCharsets', () => {
		it('returns all charset names', () => {
			const charsets = getAvailableCharsets();
			expect(charsets).toContain('alphanumeric');
			expect(charsets).toContain('special');
			expect(charsets).toContain('hex');
			expect(charsets).toContain('numeric');
			expect(charsets).toContain('alpha');
		});
	});
});
