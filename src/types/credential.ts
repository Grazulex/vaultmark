export type CredentialType = 'ssh-cert' | 'password';
export type CredentialStatus = 'active' | 'expired' | 'revoked';

export interface Credential {
	id: string;
	type: CredentialType;
	host: string;
	user: string;
	label: string;
	serial: number;
	status: CredentialStatus;
	createdAt: string;
	expiresAt: string;
	revokedAt: string | null;
	ttlSeconds: number;
	forceCommand: string | null;
	certPath: string | null;
	keyPath: string | null;
	passwordHash: string | null;
}

export interface AuditEntry {
	id: number;
	action: string;
	credentialId: string | null;
	details: string;
	timestamp: string;
}

export interface GrantOptions {
	host: string;
	user: string;
	ttl: string;
	forceCommand?: string;
	identity?: string;
	output?: string;
}

export interface PasswordOptions {
	label: string;
	ttl: string;
	length: number;
	charset: string;
	copy: boolean;
}
