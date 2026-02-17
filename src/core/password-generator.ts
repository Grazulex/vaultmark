import { createHash, randomBytes } from 'node:crypto';

const CHARSETS: Record<string, string> = {
	alphanumeric: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
	alpha: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
	numeric: '0123456789',
	special:
		'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[]{}|;:,.<>?',
	hex: '0123456789abcdef',
};

export function generatePassword(length: number, charset: string): string {
	const chars = CHARSETS[charset] || CHARSETS.alphanumeric;
	const bytes = randomBytes(length);
	const result: string[] = [];

	for (let i = 0; i < length; i++) {
		result.push(chars[bytes[i] % chars.length]);
	}

	return result.join('');
}

export function hashPassword(password: string): string {
	return createHash('sha256').update(password).digest('hex');
}

export function getAvailableCharsets(): string[] {
	return Object.keys(CHARSETS);
}
