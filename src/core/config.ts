import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import YAML from 'yaml';
import { DEFAULT_CONFIG } from '../types/config';
import type { VaultMarkConfig } from '../types/config';
import { ConfigError } from '../utils/errors';

const VAULTMARK_DIR = join(homedir(), '.vaultmark');
const CONFIG_FILE = join(VAULTMARK_DIR, 'config.yml');
const CA_DIR = join(VAULTMARK_DIR, 'ca');
const GRANTS_DIR = join(VAULTMARK_DIR, 'grants');
const DB_FILE = join(VAULTMARK_DIR, 'credentials.db');
const KRL_FILE = join(VAULTMARK_DIR, 'krl');

export const paths = {
	root: VAULTMARK_DIR,
	config: CONFIG_FILE,
	caDir: CA_DIR,
	caKey: join(CA_DIR, 'ca_key.enc'),
	caPub: join(CA_DIR, 'ca_key.pub'),
	caSalt: join(CA_DIR, 'ca_key.salt'),
	grantsDir: GRANTS_DIR,
	db: DB_FILE,
	krl: KRL_FILE,

	grantDir(id: string): string {
		return join(GRANTS_DIR, id);
	},

	grantKey(id: string): string {
		return join(GRANTS_DIR, id, 'id_ed25519');
	},

	grantPub(id: string): string {
		return join(GRANTS_DIR, id, 'id_ed25519.pub');
	},

	grantCert(id: string): string {
		return join(GRANTS_DIR, id, 'id_ed25519-cert.pub');
	},
};

export function ensureDirs(): void {
	for (const dir of [VAULTMARK_DIR, CA_DIR, GRANTS_DIR]) {
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true, mode: 0o700 });
		}
	}
}

export function isInitialized(): boolean {
	return existsSync(CONFIG_FILE) && existsSync(paths.caKey) && existsSync(paths.caPub);
}

export function ensureInitialized(): void {
	if (!isInitialized()) {
		throw new ConfigError('VaultMark is not initialized', ['Run: vaultmark init']);
	}
}

export function loadConfig(): VaultMarkConfig {
	if (!existsSync(CONFIG_FILE)) {
		return { ...DEFAULT_CONFIG };
	}

	const content = readFileSync(CONFIG_FILE, 'utf-8');
	const parsed = YAML.parse(content) as Partial<VaultMarkConfig>;

	return {
		...DEFAULT_CONFIG,
		...parsed,
		defaults: {
			...DEFAULT_CONFIG.defaults,
			...parsed.defaults,
		},
	};
}

export function saveConfig(config: VaultMarkConfig): void {
	ensureDirs();
	const content = YAML.stringify(config);
	writeFileSync(CONFIG_FILE, content, { mode: 0o600 });
}
