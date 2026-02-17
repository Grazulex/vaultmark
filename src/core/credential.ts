import { randomUUID } from 'node:crypto';
import { existsSync, rmSync } from 'node:fs';
import type { Credential, GrantOptions, PasswordOptions } from '../types/credential';
import { CredentialError } from '../utils/errors';
import { formatTimestamp, isExpired, parseTTL } from '../utils/time';
import { generateEphemeralKeyPair, signCertificate } from './ca';
import { loadConfig, paths } from './config';
import {
	getCredential,
	getExpiredCredentials,
	getNextSerial,
	insertAudit,
	insertCredential,
	updateCredentialStatus,
} from './database';
import { revokeInKRL } from './krl';
import { generatePassword, hashPassword } from './password-generator';

export function grantSSHAccess(
	passphrase: string,
	options: GrantOptions
): { credential: Credential; sshCommand: string } {
	const config = loadConfig();
	const ttlSeconds = parseTTL(options.ttl);
	const maxTTL = parseTTL(config.maxTTL);

	if (ttlSeconds > maxTTL) {
		throw new CredentialError(`TTL ${options.ttl} exceeds maximum ${config.maxTTL}`, [
			`Maximum TTL is ${config.maxTTL}`,
		]);
	}

	// Auto-cleanup expired credentials
	cleanupExpired();

	const id = randomUUID().slice(0, 8);
	const serial = getNextSerial();
	const grantDir = paths.grantDir(id);
	const identity = options.identity || `vaultmark-${id}`;

	// Generate ephemeral keypair
	const { keyPath, pubKeyPath } = generateEphemeralKeyPair(grantDir);

	// Sign certificate
	const cert = signCertificate({
		passphrase,
		publicKeyPath: pubKeyPath,
		serial,
		principals: [options.user],
		ttlSeconds,
		keyId: identity,
		forceCommand: options.forceCommand,
	});

	const now = new Date();
	const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

	const credential: Credential = {
		id,
		type: 'ssh-cert',
		host: options.host,
		user: options.user,
		label: identity,
		serial,
		status: 'active',
		createdAt: formatTimestamp(now),
		expiresAt: formatTimestamp(expiresAt),
		revokedAt: null,
		ttlSeconds,
		forceCommand: options.forceCommand || null,
		certPath: cert.certPath,
		keyPath,
		passwordHash: null,
	};

	insertCredential(credential);
	insertAudit('grant', id, `SSH cert for ${options.user}@${options.host} (TTL: ${options.ttl})`);

	const sshCommand = `ssh -i "${keyPath}" -o CertificateFile="${cert.certPath}" ${options.user}@${options.host}`;

	return { credential, sshCommand };
}

export function createEphemeralPassword(options: PasswordOptions): {
	credential: Credential;
	password: string;
} {
	const config = loadConfig();
	const ttlSeconds = parseTTL(options.ttl);
	const maxTTL = parseTTL(config.maxTTL);

	if (ttlSeconds > maxTTL) {
		throw new CredentialError(`TTL ${options.ttl} exceeds maximum ${config.maxTTL}`);
	}

	cleanupExpired();

	const id = randomUUID().slice(0, 8);
	const password = generatePassword(options.length, options.charset);
	const now = new Date();
	const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

	const credential: Credential = {
		id,
		type: 'password',
		host: '',
		user: '',
		label: options.label,
		serial: 0,
		status: 'active',
		createdAt: formatTimestamp(now),
		expiresAt: formatTimestamp(expiresAt),
		revokedAt: null,
		ttlSeconds,
		forceCommand: null,
		certPath: null,
		keyPath: null,
		passwordHash: hashPassword(password),
	};

	insertCredential(credential);
	insertAudit('password', id, `Password "${options.label}" (TTL: ${options.ttl})`);

	return { credential, password };
}

export function revokeCredential(id: string): Credential {
	const cred = getCredential(id);

	if (!cred) {
		throw new CredentialError(`Credential "${id}" not found`);
	}

	if (cred.status === 'revoked') {
		throw new CredentialError(`Credential "${id}" is already revoked`);
	}

	const now = formatTimestamp();

	// Update KRL if SSH cert
	if (cred.type === 'ssh-cert' && cred.certPath && existsSync(cred.certPath)) {
		revokeInKRL(cred.certPath);
	}

	// Delete grant files
	const grantDir = paths.grantDir(id);
	if (existsSync(grantDir)) {
		rmSync(grantDir, { recursive: true, force: true });
	}

	updateCredentialStatus(id, 'revoked', now);
	insertAudit('revoke', id, 'Credential revoked');

	return { ...cred, status: 'revoked', revokedAt: now };
}

export function cleanupExpired(): number {
	const expired = getExpiredCredentials();
	let count = 0;

	for (const cred of expired) {
		// Delete grant files
		const grantDir = paths.grantDir(cred.id);
		if (existsSync(grantDir)) {
			rmSync(grantDir, { recursive: true, force: true });
		}

		updateCredentialStatus(cred.id, 'expired');
		insertAudit('cleanup', cred.id, 'Credential expired and cleaned up');
		count++;
	}

	return count;
}
