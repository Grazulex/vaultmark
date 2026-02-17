export interface VaultMarkConfig {
	keyId: string;
	createdAt: string;
	maxTTL: string;
	defaults: DefaultsConfig;
}

export interface DefaultsConfig {
	ttl: string;
	passwordLength: number;
	passwordCharset: string;
}

export const DEFAULT_CONFIG: VaultMarkConfig = {
	keyId: 'vaultmark-ca',
	createdAt: '',
	maxTTL: '24h',
	defaults: {
		ttl: '1h',
		passwordLength: 32,
		passwordCharset: 'alphanumeric',
	},
};
