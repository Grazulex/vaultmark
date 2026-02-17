import { colors } from './colors';

export class VaultMarkError extends Error {
	constructor(
		message: string,
		public suggestions: string[] = []
	) {
		super(message);
		this.name = 'VaultMarkError';
	}
}

export class CAError extends VaultMarkError {
	constructor(message: string, suggestions: string[] = []) {
		super(message, suggestions);
		this.name = 'CAError';
	}
}

export class CredentialError extends VaultMarkError {
	constructor(message: string, suggestions: string[] = []) {
		super(message, suggestions);
		this.name = 'CredentialError';
	}
}

export class ConfigError extends VaultMarkError {
	constructor(message: string, suggestions: string[] = []) {
		super(message, suggestions);
		this.name = 'ConfigError';
	}
}

export class SSHError extends VaultMarkError {
	constructor(message: string, suggestions: string[] = []) {
		super(message, suggestions);
		this.name = 'SSHError';
	}
}

export function formatError(error: VaultMarkError): void {
	console.error();
	console.error(colors.error(`\u2716 ${error.message}`));

	if (error.suggestions.length > 0) {
		console.error();
		console.error(colors.muted('Suggestions:'));
		for (const suggestion of error.suggestions) {
			console.error(`  ${colors.muted('\u2022')} ${suggestion}`);
		}
	}

	console.error();
}

export function handleError(error: unknown): never {
	if (error instanceof VaultMarkError) {
		formatError(error);
	} else if (error instanceof Error) {
		console.error();
		console.error(colors.error(`\u2716 ${error.message}`));
		console.error();
	} else {
		console.error();
		console.error(colors.error('\u2716 An unexpected error occurred'));
		console.error();
	}

	process.exit(1);
}
