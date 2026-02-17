import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

export function generateSalt(): Buffer {
	return randomBytes(SALT_LENGTH);
}

export function deriveKey(passphrase: string, salt: Buffer): Buffer {
	return scryptSync(passphrase, salt, KEY_LENGTH, {
		N: SCRYPT_N,
		r: SCRYPT_R,
		p: SCRYPT_P,
	});
}

export function encrypt(data: Buffer, passphrase: string, salt: Buffer): Buffer {
	const key = deriveKey(passphrase, salt);
	const iv = randomBytes(IV_LENGTH);

	const cipher = createCipheriv(ALGORITHM, key, iv);
	const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
	const authTag = cipher.getAuthTag();

	// Zero key from memory
	key.fill(0);

	// Format: iv(12) + authTag(16) + encrypted(...)
	return Buffer.concat([iv, authTag, encrypted]);
}

export function decrypt(encryptedData: Buffer, passphrase: string, salt: Buffer): Buffer {
	if (encryptedData.length < IV_LENGTH + AUTH_TAG_LENGTH) {
		throw new Error('Invalid encrypted data: too short');
	}

	const key = deriveKey(passphrase, salt);
	const iv = encryptedData.subarray(0, IV_LENGTH);
	const authTag = encryptedData.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
	const data = encryptedData.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

	const decipher = createDecipheriv(ALGORITHM, key, iv);
	decipher.setAuthTag(authTag);

	let decrypted: Buffer;
	try {
		decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
	} catch {
		throw new Error('Decryption failed: invalid passphrase or corrupted data');
	} finally {
		// Zero key from memory
		key.fill(0);
	}

	return decrypted;
}

export function zeroBuffer(buf: Buffer): void {
	buf.fill(0);
}
