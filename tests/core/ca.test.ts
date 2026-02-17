import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { tmpDir } = vi.hoisted(() => {
	const { mkdtempSync } = require('node:fs');
	const { tmpdir } = require('node:os');
	const { join } = require('node:path');
	return { tmpDir: mkdtempSync(join(tmpdir(), 'vaultmark-ca-test-')) };
});

vi.mock('../../src/core/config', () => ({
	paths: {
		root: tmpDir,
		caDir: join(tmpDir, 'ca'),
		caKey: join(tmpDir, 'ca', 'ca_key.enc'),
		caPub: join(tmpDir, 'ca', 'ca_key.pub'),
		caSalt: join(tmpDir, 'ca', 'ca_key.salt'),
		grantsDir: join(tmpDir, 'grants'),
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
}));

import {
	generateEphemeralKeyPair,
	getCAPublicKey,
	initCA,
	loadCAPrivateKey,
} from '../../src/core/ca';

describe('CA', () => {
	const passphrase = 'test-passphrase-12345678';

	beforeEach(() => {
		// Clean CA dir
		const caDir = join(tmpDir, 'ca');
		if (existsSync(caDir)) rmSync(caDir, { recursive: true, force: true });
		mkdirSync(caDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
		mkdirSync(tmpDir, { recursive: true });
	});

	it('initializes a CA keypair', () => {
		const { publicKey } = initCA(passphrase, 'test-ca');

		expect(publicKey).toContain('ssh-ed25519');
		expect(existsSync(join(tmpDir, 'ca', 'ca_key.enc'))).toBe(true);
		expect(existsSync(join(tmpDir, 'ca', 'ca_key.pub'))).toBe(true);
		expect(existsSync(join(tmpDir, 'ca', 'ca_key.salt'))).toBe(true);
	});

	it('retrieves CA public key', () => {
		initCA(passphrase, 'test-ca');
		const pubKey = getCAPublicKey();
		expect(pubKey).toContain('ssh-ed25519');
	});

	it('decrypts CA private key with correct passphrase', () => {
		initCA(passphrase, 'test-ca');
		const privateKey = loadCAPrivateKey(passphrase);
		expect(privateKey).toBeInstanceOf(Buffer);
		expect(privateKey.length).toBeGreaterThan(0);
	});

	it('fails to decrypt with wrong passphrase', () => {
		initCA(passphrase, 'test-ca');
		expect(() => loadCAPrivateKey('wrong-passphrase')).toThrow('Invalid passphrase');
	});

	it('refuses to reinitialize without force', () => {
		initCA(passphrase, 'test-ca');
		expect(() => initCA(passphrase, 'test-ca')).toThrow('already initialized');
	});

	it('generates ephemeral keypair', () => {
		const grantDir = join(tmpDir, 'grants', 'test-grant');
		const { keyPath, pubKeyPath } = generateEphemeralKeyPair(grantDir);

		expect(existsSync(keyPath)).toBe(true);
		expect(existsSync(pubKeyPath)).toBe(true);
	});
});
