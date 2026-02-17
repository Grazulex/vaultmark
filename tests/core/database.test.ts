import { existsSync, mkdtempSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { tmpDir } = vi.hoisted(() => {
	const { mkdtempSync } = require('node:fs');
	const { tmpdir } = require('node:os');
	const { join } = require('node:path');
	return { tmpDir: mkdtempSync(join(tmpdir(), 'vaultmark-test-')) };
});

vi.mock('../../src/core/config', () => ({
	paths: {
		root: tmpDir,
		db: join(tmpDir, 'test.db'),
		grantsDir: join(tmpDir, 'grants'),
		grantDir: (id: string) => join(tmpDir, 'grants', id),
	},
}));

import {
	closeDb,
	getCredential,
	getCredentialCounts,
	getNextSerial,
	insertAudit,
	insertCredential,
	listAudit,
	listCredentials,
	updateCredentialStatus,
} from '../../src/core/database';
import type { Credential } from '../../src/types/credential';

function makeCredential(overrides: Partial<Credential> = {}): Credential {
	return {
		id: 'test-id',
		type: 'ssh-cert',
		host: 'example.com',
		user: 'testuser',
		label: 'test-cert',
		serial: 1,
		status: 'active',
		createdAt: new Date().toISOString(),
		expiresAt: new Date(Date.now() + 3600000).toISOString(),
		revokedAt: null,
		ttlSeconds: 3600,
		forceCommand: null,
		certPath: '/tmp/cert',
		keyPath: '/tmp/key',
		passwordHash: null,
		...overrides,
	};
}

const dbPath = join(tmpDir, 'test.db');

describe('database', () => {
	beforeEach(() => {
		closeDb();
		// Remove DB file to start fresh each test
		for (const suffix of ['', '-wal', '-shm']) {
			const f = `${dbPath}${suffix}`;
			if (existsSync(f)) unlinkSync(f);
		}
	});

	afterEach(() => {
		closeDb();
	});

	it('inserts and retrieves a credential', () => {
		const cred = makeCredential();
		insertCredential(cred);

		const retrieved = getCredential('test-id');
		expect(retrieved).not.toBeNull();
		expect(retrieved?.id).toBe('test-id');
		expect(retrieved?.host).toBe('example.com');
		expect(retrieved?.type).toBe('ssh-cert');
	});

	it('returns null for non-existent credential', () => {
		const retrieved = getCredential('nonexistent');
		expect(retrieved).toBeNull();
	});

	it('lists credentials with filters', () => {
		insertCredential(makeCredential({ id: 'a', status: 'active' }));
		insertCredential(makeCredential({ id: 'b', status: 'revoked' }));

		const active = listCredentials({ status: 'active' });
		expect(active.length).toBe(1);
		expect(active[0].id).toBe('a');

		const all = listCredentials({ includeAll: true });
		expect(all.length).toBe(2);
	});

	it('updates credential status', () => {
		insertCredential(makeCredential({ id: 'upd' }));
		updateCredentialStatus('upd', 'revoked', new Date().toISOString());

		const cred = getCredential('upd');
		expect(cred?.status).toBe('revoked');
		expect(cred?.revokedAt).not.toBeNull();
	});

	it('tracks serial numbers', () => {
		expect(getNextSerial()).toBe(1);
		insertCredential(makeCredential({ id: 's1', serial: 1 }));
		expect(getNextSerial()).toBe(2);
	});

	it('counts credentials by status', () => {
		insertCredential(makeCredential({ id: 'c1', status: 'active' }));
		insertCredential(makeCredential({ id: 'c2', status: 'active' }));
		insertCredential(makeCredential({ id: 'c3', status: 'revoked' }));

		const counts = getCredentialCounts();
		expect(counts.active).toBe(2);
		expect(counts.revoked).toBe(1);
		expect(counts.expired).toBe(0);
	});

	it('inserts and lists audit entries', () => {
		insertAudit('grant', 'cred-1', 'SSH cert created');
		insertAudit('revoke', 'cred-1', 'Credential revoked');

		const entries = listAudit({ limit: 10 });
		expect(entries.length).toBe(2);
		expect(entries[0].action).toBe('revoke'); // Most recent first
	});

	it('filters audit by action', () => {
		insertAudit('grant', 'a', 'test');
		insertAudit('revoke', 'b', 'test');

		const grants = listAudit({ action: 'grant' });
		expect(grants.length).toBe(1);
		expect(grants[0].credentialId).toBe('a');
	});
});
