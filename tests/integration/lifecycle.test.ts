import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { tmpDir } = vi.hoisted(() => {
	const { mkdtempSync } = require('node:fs');
	const { tmpdir } = require('node:os');
	const { join } = require('node:path');
	return { tmpDir: mkdtempSync(join(tmpdir(), 'vaultmark-integ-')) };
});

vi.mock('../../src/core/config', async (importOriginal) => {
	const original = (await importOriginal()) as any;
	const grantsDir = join(tmpDir, 'grants');
	return {
		...original,
		paths: {
			root: tmpDir,
			config: join(tmpDir, 'config.yml'),
			caDir: join(tmpDir, 'ca'),
			caKey: join(tmpDir, 'ca', 'ca_key.enc'),
			caPub: join(tmpDir, 'ca', 'ca_key.pub'),
			caSalt: join(tmpDir, 'ca', 'ca_key.salt'),
			grantsDir,
			db: join(tmpDir, 'credentials.db'),
			krl: join(tmpDir, 'krl'),
			grantDir: (id: string) => join(grantsDir, id),
			grantKey: (id: string) => join(grantsDir, id, 'id_ed25519'),
			grantPub: (id: string) => join(grantsDir, id, 'id_ed25519.pub'),
			grantCert: (id: string) => join(grantsDir, id, 'id_ed25519-cert.pub'),
		},
		ensureDirs: () => {
			for (const dir of [tmpDir, join(tmpDir, 'ca'), grantsDir]) {
				if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
			}
		},
		isInitialized: () => {
			return (
				existsSync(join(tmpDir, 'config.yml')) &&
				existsSync(join(tmpDir, 'ca', 'ca_key.enc')) &&
				existsSync(join(tmpDir, 'ca', 'ca_key.pub'))
			);
		},
		ensureInitialized: () => {
			if (
				!existsSync(join(tmpDir, 'config.yml')) ||
				!existsSync(join(tmpDir, 'ca', 'ca_key.enc'))
			) {
				throw new Error('VaultMark is not initialized');
			}
		},
		loadConfig: () => ({
			keyId: 'test-ca',
			createdAt: new Date().toISOString(),
			maxTTL: '24h',
			defaults: { ttl: '1h', passwordLength: 32, passwordCharset: 'alphanumeric' },
		}),
		saveConfig: (config: any) => {
			const { writeFileSync } = require('node:fs');
			const YAML = require('yaml');
			writeFileSync(join(tmpDir, 'config.yml'), YAML.stringify(config), { mode: 0o600 });
		},
	};
});

import { initCA } from '../../src/core/ca';
import { ensureDirs, saveConfig } from '../../src/core/config';
import {
	cleanupExpired,
	createEphemeralPassword,
	grantSSHAccess,
	revokeCredential,
} from '../../src/core/credential';
import {
	closeDb,
	getCredential,
	getCredentialCounts,
	listAudit,
	listCredentials,
} from '../../src/core/database';
import { initKRL } from '../../src/core/krl';

const PASSPHRASE = 'integration-test-passphrase-123';

function setupCA(): void {
	ensureDirs();
	initCA(PASSPHRASE, 'test-ca');
	saveConfig({
		keyId: 'test-ca',
		createdAt: new Date().toISOString(),
		maxTTL: '24h',
		defaults: { ttl: '1h', passwordLength: 32, passwordCharset: 'alphanumeric' },
	});
	initKRL();
}

function cleanAll(): void {
	closeDb();
	rmSync(tmpDir, { recursive: true, force: true });
	mkdirSync(tmpDir, { recursive: true, mode: 0o700 });
}

describe('Integration: SSH Certificate Lifecycle', () => {
	beforeEach(() => {
		cleanAll();
		setupCA();
	});

	afterEach(() => {
		closeDb();
	});

	afterAll(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it('full lifecycle: grant -> list -> revoke -> audit', () => {
		// Grant
		const { credential, sshCommand } = grantSSHAccess(PASSPHRASE, {
			host: 'test.example.com',
			user: 'deploy',
			ttl: '5m',
		});

		expect(credential.id).toBeTruthy();
		expect(credential.type).toBe('ssh-cert');
		expect(credential.status).toBe('active');
		expect(credential.host).toBe('test.example.com');
		expect(credential.user).toBe('deploy');
		expect(credential.ttlSeconds).toBe(300);
		expect(credential.serial).toBe(1);
		expect(sshCommand).toContain('ssh -i');
		expect(sshCommand).toContain('deploy@test.example.com');

		// Verify files exist
		expect(credential.keyPath).toBeTruthy();
		expect(credential.certPath).toBeTruthy();
		expect(existsSync(credential.keyPath as string)).toBe(true);
		expect(existsSync(credential.certPath as string)).toBe(true);

		// List
		const active = listCredentials({ status: 'active' });
		expect(active).toHaveLength(1);
		expect(active[0].id).toBe(credential.id);

		// Revoke
		const revoked = revokeCredential(credential.id);
		expect(revoked.status).toBe('revoked');
		expect(revoked.revokedAt).toBeTruthy();

		// Verify files deleted
		const grantDir = join(tmpDir, 'grants', credential.id);
		expect(existsSync(grantDir)).toBe(false);

		// List after revoke
		const afterRevoke = listCredentials({ status: 'active' });
		expect(afterRevoke).toHaveLength(0);

		const allCreds = listCredentials({ includeAll: true });
		expect(allCreds).toHaveLength(1);
		expect(allCreds[0].status).toBe('revoked');

		// Audit
		const audit = listAudit({});
		expect(audit.length).toBeGreaterThanOrEqual(2);

		const actions = audit.map((a) => a.action);
		expect(actions).toContain('grant');
		expect(actions).toContain('revoke');
	});

	it('grant with force-command restricts access', () => {
		const { credential } = grantSSHAccess(PASSPHRASE, {
			host: 'server.local',
			user: 'backup',
			ttl: '10m',
			forceCommand: 'rsync --server',
		});

		expect(credential.forceCommand).toBe('rsync --server');

		const retrieved = getCredential(credential.id);
		expect(retrieved?.forceCommand).toBe('rsync --server');
	});

	it('multiple grants have incrementing serials', () => {
		const { credential: c1 } = grantSSHAccess(PASSPHRASE, {
			host: 'host1.com',
			user: 'user1',
			ttl: '5m',
		});
		const { credential: c2 } = grantSSHAccess(PASSPHRASE, {
			host: 'host2.com',
			user: 'user2',
			ttl: '5m',
		});
		const { credential: c3 } = grantSSHAccess(PASSPHRASE, {
			host: 'host3.com',
			user: 'user3',
			ttl: '5m',
		});

		expect(c1.serial).toBe(1);
		expect(c2.serial).toBe(2);
		expect(c3.serial).toBe(3);

		// List shows all 3
		const active = listCredentials({ status: 'active' });
		expect(active).toHaveLength(3);

		// Revoke middle one
		revokeCredential(c2.id);

		const afterRevoke = listCredentials({ status: 'active' });
		expect(afterRevoke).toHaveLength(2);
		expect(afterRevoke.map((c) => c.id)).not.toContain(c2.id);
	});

	it('list filters by host', () => {
		grantSSHAccess(PASSPHRASE, { host: 'alpha.com', user: 'u', ttl: '5m' });
		grantSSHAccess(PASSPHRASE, { host: 'beta.com', user: 'u', ttl: '5m' });
		grantSSHAccess(PASSPHRASE, { host: 'alpha.com', user: 'v', ttl: '5m' });

		const alphaOnly = listCredentials({ host: 'alpha.com' });
		expect(alphaOnly).toHaveLength(2);

		const betaOnly = listCredentials({ host: 'beta.com' });
		expect(betaOnly).toHaveLength(1);
	});

	it('rejects TTL exceeding max', () => {
		expect(() =>
			grantSSHAccess(PASSPHRASE, {
				host: 'host.com',
				user: 'user',
				ttl: '48h',
			})
		).toThrow('exceeds maximum');
	});

	it('revoke non-existent credential throws', () => {
		expect(() => revokeCredential('nonexistent')).toThrow('not found');
	});

	it('double revoke throws', () => {
		const { credential } = grantSSHAccess(PASSPHRASE, {
			host: 'host.com',
			user: 'user',
			ttl: '5m',
		});

		revokeCredential(credential.id);
		expect(() => revokeCredential(credential.id)).toThrow('already revoked');
	});
});

describe('Integration: Password Lifecycle', () => {
	beforeEach(() => {
		cleanAll();
		setupCA();
	});

	afterEach(() => {
		closeDb();
	});

	afterAll(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it('full lifecycle: create -> list -> verify hash', () => {
		const { credential, password } = createEphemeralPassword({
			label: 'db-root',
			ttl: '10m',
			length: 24,
			charset: 'alphanumeric',
			copy: false,
		});

		expect(password).toHaveLength(24);
		expect(credential.type).toBe('password');
		expect(credential.label).toBe('db-root');
		expect(credential.status).toBe('active');
		expect(credential.passwordHash).toBeTruthy();
		expect(credential.passwordHash).not.toBe(password);

		// List
		const passwords = listCredentials({ type: 'password' });
		expect(passwords).toHaveLength(1);
		expect(passwords[0].label).toBe('db-root');

		// Audit
		const audit = listAudit({ action: 'password' });
		expect(audit).toHaveLength(1);
		expect(audit[0].details).toContain('db-root');
	});

	it('different charsets produce valid passwords', () => {
		const { password: hex } = createEphemeralPassword({
			label: 'hex',
			ttl: '5m',
			length: 32,
			charset: 'hex',
			copy: false,
		});
		expect(hex).toMatch(/^[0-9a-f]+$/);

		const { password: numeric } = createEphemeralPassword({
			label: 'numeric',
			ttl: '5m',
			length: 16,
			charset: 'numeric',
			copy: false,
		});
		expect(numeric).toMatch(/^[0-9]+$/);
	});

	it('password TTL exceeding max throws', () => {
		expect(() =>
			createEphemeralPassword({
				label: 'too-long',
				ttl: '48h',
				length: 32,
				charset: 'alphanumeric',
				copy: false,
			})
		).toThrow('exceeds maximum');
	});
});

describe('Integration: Cleanup', () => {
	beforeEach(() => {
		cleanAll();
		setupCA();
	});

	afterEach(() => {
		closeDb();
	});

	afterAll(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it('cleans up expired credentials with short TTL', async () => {
		// Create with 1s TTL
		const { credential } = grantSSHAccess(PASSPHRASE, {
			host: 'host.com',
			user: 'user',
			ttl: '1s',
		});

		expect(credential.status).toBe('active');
		const grantDir = join(tmpDir, 'grants', credential.id);
		expect(existsSync(grantDir)).toBe(true);

		// Wait for expiry
		await new Promise((resolve) => setTimeout(resolve, 1500));

		// Cleanup
		const cleaned = cleanupExpired();
		expect(cleaned).toBe(1);

		// Verify files removed
		expect(existsSync(grantDir)).toBe(false);

		// Verify status changed
		const cred = getCredential(credential.id);
		expect(cred?.status).toBe('expired');

		// Audit
		const audit = listAudit({ action: 'cleanup' });
		expect(audit.length).toBeGreaterThanOrEqual(1);
	});

	it('does not clean active credentials', () => {
		grantSSHAccess(PASSPHRASE, {
			host: 'host.com',
			user: 'user',
			ttl: '1h',
		});

		const cleaned = cleanupExpired();
		expect(cleaned).toBe(0);

		const active = listCredentials({ status: 'active' });
		expect(active).toHaveLength(1);
	});
});

describe('Integration: Credential Counts', () => {
	beforeEach(() => {
		cleanAll();
		setupCA();
	});

	afterEach(() => {
		closeDb();
	});

	afterAll(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it('counts reflect all statuses', async () => {
		// Create 3 credentials
		const { credential: c1 } = grantSSHAccess(PASSPHRASE, {
			host: 'h1.com',
			user: 'u',
			ttl: '1h',
		});
		grantSSHAccess(PASSPHRASE, { host: 'h2.com', user: 'u', ttl: '1s' });
		const { credential: c3 } = grantSSHAccess(PASSPHRASE, {
			host: 'h3.com',
			user: 'u',
			ttl: '1h',
		});

		// Revoke one
		revokeCredential(c1.id);

		// Wait for one to expire
		await new Promise((resolve) => setTimeout(resolve, 1500));
		cleanupExpired();

		const counts = getCredentialCounts();
		expect(counts.active).toBe(1);
		expect(counts.revoked).toBe(1);
		expect(counts.expired).toBe(1);
	});
});

describe('Integration: Audit Trail', () => {
	beforeEach(() => {
		cleanAll();
		setupCA();
	});

	afterEach(() => {
		closeDb();
	});

	afterAll(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it('records complete audit trail for mixed operations', () => {
		// Grant SSH
		const { credential: ssh } = grantSSHAccess(PASSPHRASE, {
			host: 'server.com',
			user: 'admin',
			ttl: '5m',
		});

		// Create password
		createEphemeralPassword({
			label: 'api-key',
			ttl: '10m',
			length: 32,
			charset: 'alphanumeric',
			copy: false,
		});

		// Revoke SSH
		revokeCredential(ssh.id);

		// Check audit
		const audit = listAudit({});
		expect(audit.length).toBeGreaterThanOrEqual(3);

		const actions = audit.map((a) => a.action);
		expect(actions).toContain('grant');
		expect(actions).toContain('password');
		expect(actions).toContain('revoke');

		// Filter by credential
		const sshAudit = listAudit({ credentialId: ssh.id });
		expect(sshAudit).toHaveLength(2); // grant + revoke
	});
});
