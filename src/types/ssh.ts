export interface CAKeyPair {
	publicKey: string;
	privateKeyEncrypted: Buffer;
	salt: Buffer;
}

export interface SSHCertificate {
	certPath: string;
	keyPath: string;
	pubKeyPath: string;
	serial: number;
	principals: string[];
	validAfter: Date;
	validBefore: Date;
	forceCommand?: string;
}

export interface HostSetupOptions {
	host: string;
	user: string;
	port: number;
	identityFile?: string;
	dryRun: boolean;
}

export interface HostSetupResult {
	success: boolean;
	steps: HostSetupStep[];
}

export interface HostSetupStep {
	description: string;
	command: string;
	success: boolean;
	error?: string;
}
