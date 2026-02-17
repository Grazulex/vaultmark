import { execSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { paths } from './config';

export function initKRL(): void {
	if (!existsSync(paths.krl)) {
		// Create an empty KRL
		writeFileSync(paths.krl, Buffer.alloc(0));
	}
}

export function revokeInKRL(certPath: string): void {
	if (!existsSync(certPath)) {
		return;
	}

	try {
		if (existsSync(paths.krl) && getKRLSize() > 0) {
			// Update existing KRL
			execSync(`ssh-keygen -k -u -f "${paths.krl}" "${certPath}"`, { stdio: 'pipe' });
		} else {
			// Create new KRL with this certificate
			execSync(`ssh-keygen -k -f "${paths.krl}" "${certPath}"`, { stdio: 'pipe' });
		}
	} catch {
		// If ssh-keygen -k fails (e.g., empty KRL), recreate
		execSync(`ssh-keygen -k -f "${paths.krl}" "${certPath}"`, { stdio: 'pipe' });
	}
}

function getKRLSize(): number {
	try {
		const { size } = require('node:fs').statSync(paths.krl);
		return size;
	} catch {
		return 0;
	}
}
