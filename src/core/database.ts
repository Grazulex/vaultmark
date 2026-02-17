import Database from 'better-sqlite3';
import type { AuditEntry, Credential, CredentialStatus, CredentialType } from '../types/credential';
import { paths } from './config';

let db: Database.Database | null = null;

function getDb(): Database.Database {
	if (!db) {
		db = new Database(paths.db);
		db.pragma('journal_mode = WAL');
		db.pragma('foreign_keys = ON');
		initSchema(db);
	}
	return db;
}

function initSchema(database: Database.Database): void {
	database.exec(`
		CREATE TABLE IF NOT EXISTS credentials (
			id TEXT PRIMARY KEY,
			type TEXT NOT NULL,
			host TEXT NOT NULL DEFAULT '',
			user TEXT NOT NULL DEFAULT '',
			label TEXT NOT NULL DEFAULT '',
			serial INTEGER NOT NULL DEFAULT 0,
			status TEXT NOT NULL DEFAULT 'active',
			created_at TEXT NOT NULL,
			expires_at TEXT NOT NULL,
			revoked_at TEXT,
			ttl_seconds INTEGER NOT NULL,
			force_command TEXT,
			cert_path TEXT,
			key_path TEXT,
			password_hash TEXT
		);

		CREATE TABLE IF NOT EXISTS audit_log (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			action TEXT NOT NULL,
			credential_id TEXT,
			details TEXT NOT NULL DEFAULT '',
			timestamp TEXT NOT NULL
		);

		CREATE INDEX IF NOT EXISTS idx_credentials_status ON credentials(status);
		CREATE INDEX IF NOT EXISTS idx_credentials_expires ON credentials(expires_at);
		CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
	`);
}

export function insertCredential(cred: Credential): void {
	const stmt = getDb().prepare(`
		INSERT INTO credentials (id, type, host, user, label, serial, status, created_at, expires_at, revoked_at, ttl_seconds, force_command, cert_path, key_path, password_hash)
		VALUES (@id, @type, @host, @user, @label, @serial, @status, @createdAt, @expiresAt, @revokedAt, @ttlSeconds, @forceCommand, @certPath, @keyPath, @passwordHash)
	`);

	stmt.run({
		id: cred.id,
		type: cred.type,
		host: cred.host,
		user: cred.user,
		label: cred.label,
		serial: cred.serial,
		status: cred.status,
		createdAt: cred.createdAt,
		expiresAt: cred.expiresAt,
		revokedAt: cred.revokedAt,
		ttlSeconds: cred.ttlSeconds,
		forceCommand: cred.forceCommand,
		certPath: cred.certPath,
		keyPath: cred.keyPath,
		passwordHash: cred.passwordHash,
	});
}

export function getCredential(id: string): Credential | null {
	const row = getDb().prepare('SELECT * FROM credentials WHERE id = ?').get(id) as any;

	return row ? mapRow(row) : null;
}

export function listCredentials(filters?: {
	type?: CredentialType;
	status?: CredentialStatus;
	host?: string;
	includeAll?: boolean;
}): Credential[] {
	let query = 'SELECT * FROM credentials WHERE 1=1';
	const params: any[] = [];

	if (filters?.type) {
		query += ' AND type = ?';
		params.push(filters.type);
	}

	if (filters?.status) {
		query += ' AND status = ?';
		params.push(filters.status);
	} else if (!filters?.includeAll) {
		query += " AND status = 'active'";
	}

	if (filters?.host) {
		query += ' AND host = ?';
		params.push(filters.host);
	}

	query += ' ORDER BY created_at DESC';

	const rows = getDb()
		.prepare(query)
		.all(...params) as any[];
	return rows.map(mapRow);
}

export function updateCredentialStatus(
	id: string,
	status: CredentialStatus,
	revokedAt?: string
): void {
	getDb()
		.prepare('UPDATE credentials SET status = ?, revoked_at = ? WHERE id = ?')
		.run(status, revokedAt || null, id);
}

export function getNextSerial(): number {
	const row = getDb()
		.prepare('SELECT COALESCE(MAX(serial), 0) + 1 as next_serial FROM credentials')
		.get() as any;
	return row.next_serial;
}

export function getExpiredCredentials(): Credential[] {
	const now = new Date().toISOString();
	const rows = getDb()
		.prepare("SELECT * FROM credentials WHERE status = 'active' AND expires_at <= ?")
		.all(now) as any[];
	return rows.map(mapRow);
}

export function insertAudit(action: string, credentialId: string | null, details: string): void {
	getDb()
		.prepare(
			'INSERT INTO audit_log (action, credential_id, details, timestamp) VALUES (?, ?, ?, ?)'
		)
		.run(action, credentialId, details, new Date().toISOString());
}

export function listAudit(filters?: {
	limit?: number;
	action?: string;
	credentialId?: string;
	since?: string;
}): AuditEntry[] {
	let query = 'SELECT * FROM audit_log WHERE 1=1';
	const params: any[] = [];

	if (filters?.action) {
		query += ' AND action = ?';
		params.push(filters.action);
	}

	if (filters?.credentialId) {
		query += ' AND credential_id = ?';
		params.push(filters.credentialId);
	}

	if (filters?.since) {
		query += ' AND timestamp >= ?';
		params.push(filters.since);
	}

	query += ' ORDER BY timestamp DESC';

	if (filters?.limit) {
		query += ' LIMIT ?';
		params.push(filters.limit);
	}

	const rows = getDb()
		.prepare(query)
		.all(...params) as any[];
	return rows.map((row) => ({
		id: row.id,
		action: row.action,
		credentialId: row.credential_id,
		details: row.details,
		timestamp: row.timestamp,
	}));
}

export function getCredentialCounts(): { active: number; expired: number; revoked: number } {
	const rows = getDb()
		.prepare('SELECT status, COUNT(*) as count FROM credentials GROUP BY status')
		.all() as any[];

	const counts = { active: 0, expired: 0, revoked: 0 };
	for (const row of rows) {
		if (row.status in counts) {
			counts[row.status as keyof typeof counts] = row.count;
		}
	}
	return counts;
}

export function closeDb(): void {
	if (db) {
		db.close();
		db = null;
	}
}

function mapRow(row: any): Credential {
	return {
		id: row.id,
		type: row.type,
		host: row.host,
		user: row.user,
		label: row.label,
		serial: row.serial,
		status: row.status,
		createdAt: row.created_at,
		expiresAt: row.expires_at,
		revokedAt: row.revoked_at,
		ttlSeconds: row.ttl_seconds,
		forceCommand: row.force_command,
		certPath: row.cert_path,
		keyPath: row.key_path,
		passwordHash: row.password_hash,
	};
}
