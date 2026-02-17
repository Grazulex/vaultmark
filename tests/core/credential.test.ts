import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { tmpDir } = vi.hoisted(() => {
	const { mkdtempSync } = require('node:fs');
	const { tmpdir } = require('node:os');
	const { join } = require('node:path');
	return { tmpDir: mkdtempSync(join(tmpdir(), 'vaultmark-cred-test-')) };
});

vi.mock('../../src/core/config', () => ({
	paths: {
		root: tmpDir,
		config: join(tmpDir, 'config.yml'),
		caDir: join(tmpDir, 'ca'),
		caKey: join(tmpDir, 'ca', 'ca_key.enc'),
		caPub: join(tmpDir, 'ca', 'ca_key.pub'),
		caSalt: join(tmpDir, 'ca', 'ca_key.salt'),
		grantsDir: join(tmpDir, 'grants'),
		db: join(tmpDir, 'test.db'),
		krl: join(tmpDir, 'krl'),
		grantDir: (id: string) => join(tmpDir, 'grants', id),
		grantKey: (id: string) => join(tmpDir, 'grants', id, 'id_ed25519'),
		grantPub: (id: string) => join(tmpDir, 'grants', id, 'id_ed25519.pub'),
		grantCert: (id: string) => join(tmpDir, 'grants', id, 'id_ed25519-cert.pub'),
	},
	ensureDirs: () => {
		for (const dir of [tmpDir, join(tmpDir, 'ca'), join(tmpDir, 'grants')]) {
			if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
		}
	},
	loadConfig: () => ({
		keyId: 'test-ca',
		createdAt: new Date().toISOString(),
		maxTTL: '24h',
		defaults: { ttl: '1h', passwordLength: 32, passwordCharset: 'alphanumeric' },
	}),
}));

import { createEphemeralPassword } from '../../src/core/credential';
import { closeDb } from '../../src/core/database';

describe('credential', () => {
	afterEach(() => {
		closeDb();
		rmSync(tmpDir, { recursive: true, force: true });
		mkdirSync(tmpDir, { recursive: true });
	});

	describe('createEphemeralPassword', () => {
		it('generates a password with correct properties', () => {
			const { credential, password } = createEphemeralPassword({
				label: 'test-pw',
				ttl: '10m',
				length: 24,
				charset: 'alphanumeric',
				copy: false,
			});

			expect(password).toHaveLength(24);
			expect(credential.type).toBe('password');
			expect(credential.label).toBe('test-pw');
			expect(credential.status).toBe('active');
			expect(credential.ttlSeconds).toBe(600);
			expect(credential.passwordHash).not.toBeNull();
			expect(credential.passwordHash).not.toBe(password);
		});

		it('rejects TTL exceeding max', () => {
			expect(() =>
				createEphemeralPassword({
					label: 'test',
					ttl: '48h',
					length: 32,
					charset: 'alphanumeric',
					copy: false,
				})
			).toThrow('exceeds maximum');
		});
	});
});
