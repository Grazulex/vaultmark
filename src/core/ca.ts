import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SSHCertificate } from '../types/ssh';
import { CAError } from '../utils/errors';
import { ensureDirs, paths } from './config';
import { decrypt, encrypt, generateSalt, zeroBuffer } from './crypto';

export function initCA(passphrase: string, keyId: string): { publicKey: string } {
	ensureDirs();

	if (existsSync(paths.caKey)) {
		throw new CAError('CA already initialized', [
			'Use --force to reinitialize (will invalidate all existing certificates)',
		]);
	}

	// Generate Ed25519 keypair using ssh-keygen
	const tmpDir = join(tmpdir(), `vaultmark-${randomUUID()}`);
	mkdirSync(tmpDir, { mode: 0o700 });
	const tmpKeyPath = join(tmpDir, 'ca_key');

	try {
		execSync(`ssh-keygen -t ed25519 -f "${tmpKeyPath}" -N "" -C "${keyId}" -q`, { stdio: 'pipe' });

		const privateKey = readFileSync(tmpKeyPath);
		const publicKey = readFileSync(`${tmpKeyPath}.pub`, 'utf-8').trim();

		// Encrypt private key
		const salt = generateSalt();
		const encryptedKey = encrypt(privateKey, passphrase, salt);

		// Write files
		writeFileSync(paths.caKey, encryptedKey, { mode: 0o600 });
		writeFileSync(paths.caPub, publicKey, { mode: 0o644 });
		writeFileSync(paths.caSalt, salt, { mode: 0o600 });

		// Zero private key from memory
		zeroBuffer(privateKey);

		return { publicKey };
	} finally {
		// Cleanup temp files
		try {
			execSync(`rm -rf "${tmpDir}"`, { stdio: 'pipe' });
		} catch {
			// Best effort cleanup
		}
	}
}

export function loadCAPrivateKey(passphrase: string): Buffer {
	if (!existsSync(paths.caKey) || !existsSync(paths.caSalt)) {
		throw new CAError('CA not initialized', ['Run: vaultmark init']);
	}

	const encryptedKey = readFileSync(paths.caKey);
	const salt = readFileSync(paths.caSalt);

	try {
		return decrypt(encryptedKey, passphrase, salt);
	} catch {
		throw new CAError('Invalid passphrase', [
			'The passphrase used to decrypt the CA key is incorrect',
		]);
	}
}

export function getCAPublicKey(): string {
	if (!existsSync(paths.caPub)) {
		throw new CAError('CA not initialized', ['Run: vaultmark init']);
	}
	return readFileSync(paths.caPub, 'utf-8').trim();
}

export function signCertificate(opts: {
	passphrase: string;
	publicKeyPath: string;
	serial: number;
	principals: string[];
	ttlSeconds: number;
	keyId: string;
	forceCommand?: string;
}): SSHCertificate {
	const caPrivateKey = loadCAPrivateKey(opts.passphrase);

	// Write CA private key to temp file for ssh-keygen
	const tmpDir = join(tmpdir(), `vaultmark-sign-${randomUUID()}`);
	mkdirSync(tmpDir, { mode: 0o700 });
	const tmpCAKeyPath = join(tmpDir, 'ca_key');

	try {
		writeFileSync(tmpCAKeyPath, caPrivateKey, { mode: 0o600 });
		zeroBuffer(caPrivateKey);

		const now = new Date();
		const validAfter = new Date(now.getTime() - 60 * 1000); // 1 min in the past for clock skew
		const validBefore = new Date(now.getTime() + opts.ttlSeconds * 1000);

		const validAfterStr = formatSSHDate(validAfter);
		const validBeforeStr = formatSSHDate(validBefore);

		let cmd = `ssh-keygen -s "${tmpCAKeyPath}" -I "${opts.keyId}" -n "${opts.principals.join(',')}" -z ${opts.serial} -V "${validAfterStr}:${validBeforeStr}"`;

		if (opts.forceCommand) {
			cmd += ` -O force-command="${opts.forceCommand}"`;
		}

		cmd += ` "${opts.publicKeyPath}"`;

		execSync(cmd, { stdio: 'pipe' });

		const certPath = opts.publicKeyPath.replace(/\.pub$/, '-cert.pub');
		const keyPath = opts.publicKeyPath.replace(/\.pub$/, '');

		return {
			certPath,
			keyPath,
			pubKeyPath: opts.publicKeyPath,
			serial: opts.serial,
			principals: opts.principals,
			validAfter,
			validBefore,
			forceCommand: opts.forceCommand,
		};
	} finally {
		try {
			execSync(`rm -rf "${tmpDir}"`, { stdio: 'pipe' });
		} catch {
			// Best effort cleanup
		}
	}
}

export function generateEphemeralKeyPair(grantDir: string): {
	keyPath: string;
	pubKeyPath: string;
} {
	if (!existsSync(grantDir)) {
		mkdirSync(grantDir, { recursive: true, mode: 0o700 });
	}

	const keyPath = join(grantDir, 'id_ed25519');

	execSync(`ssh-keygen -t ed25519 -f "${keyPath}" -N "" -q`, { stdio: 'pipe' });
	chmodSync(keyPath, 0o600);

	return {
		keyPath,
		pubKeyPath: `${keyPath}.pub`,
	};
}

function formatSSHDate(date: Date): string {
	const y = date.getUTCFullYear();
	const m = String(date.getUTCMonth() + 1).padStart(2, '0');
	const d = String(date.getUTCDate()).padStart(2, '0');
	const h = String(date.getUTCHours()).padStart(2, '0');
	const min = String(date.getUTCMinutes()).padStart(2, '0');
	const s = String(date.getUTCSeconds()).padStart(2, '0');
	return `${y}${m}${d}${h}${min}${s}`;
}
