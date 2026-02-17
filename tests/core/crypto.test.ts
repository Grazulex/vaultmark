import { describe, expect, it } from 'vitest';
import { decrypt, deriveKey, encrypt, generateSalt, zeroBuffer } from '../../src/core/crypto';

describe('crypto', () => {
	const passphrase = 'test-passphrase-12345678';

	describe('generateSalt', () => {
		it('generates a 32-byte salt', () => {
			const salt = generateSalt();
			expect(salt).toBeInstanceOf(Buffer);
			expect(salt.length).toBe(32);
		});

		it('generates unique salts', () => {
			const salt1 = generateSalt();
			const salt2 = generateSalt();
			expect(salt1.equals(salt2)).toBe(false);
		});
	});

	describe('deriveKey', () => {
		it('derives a 32-byte key', () => {
			const salt = generateSalt();
			const key = deriveKey(passphrase, salt);
			expect(key.length).toBe(32);
		});

		it('same passphrase + salt = same key', () => {
			const salt = generateSalt();
			const key1 = deriveKey(passphrase, salt);
			const key2 = deriveKey(passphrase, salt);
			expect(key1.equals(key2)).toBe(true);
		});

		it('different salt = different key', () => {
			const salt1 = generateSalt();
			const salt2 = generateSalt();
			const key1 = deriveKey(passphrase, salt1);
			const key2 = deriveKey(passphrase, salt2);
			expect(key1.equals(key2)).toBe(false);
		});
	});

	describe('encrypt/decrypt', () => {
		it('round-trips data correctly', () => {
			const data = Buffer.from('hello world - this is secret data');
			const salt = generateSalt();

			const encrypted = encrypt(data, passphrase, salt);
			const decrypted = decrypt(encrypted, passphrase, salt);

			expect(decrypted.toString()).toBe(data.toString());
		});

		it('encrypted data differs from original', () => {
			const data = Buffer.from('secret');
			const salt = generateSalt();
			const encrypted = encrypt(data, passphrase, salt);

			expect(encrypted.equals(data)).toBe(false);
			expect(encrypted.length).toBeGreaterThan(data.length);
		});

		it('fails with wrong passphrase', () => {
			const data = Buffer.from('secret');
			const salt = generateSalt();
			const encrypted = encrypt(data, passphrase, salt);

			expect(() => decrypt(encrypted, 'wrong-passphrase', salt)).toThrow();
		});

		it('fails with wrong salt', () => {
			const data = Buffer.from('secret');
			const salt1 = generateSalt();
			const salt2 = generateSalt();
			const encrypted = encrypt(data, passphrase, salt1);

			expect(() => decrypt(encrypted, passphrase, salt2)).toThrow();
		});

		it('fails with corrupted data', () => {
			const data = Buffer.from('secret');
			const salt = generateSalt();
			const encrypted = encrypt(data, passphrase, salt);

			// Corrupt a byte
			encrypted[encrypted.length - 1] ^= 0xff;

			expect(() => decrypt(encrypted, passphrase, salt)).toThrow();
		});

		it('rejects too-short encrypted data', () => {
			const salt = generateSalt();
			expect(() => decrypt(Buffer.alloc(10), passphrase, salt)).toThrow('too short');
		});
	});

	describe('zeroBuffer', () => {
		it('zeros out buffer contents', () => {
			const buf = Buffer.from('sensitive data');
			zeroBuffer(buf);
			expect(buf.every((b) => b === 0)).toBe(true);
		});
	});
});
