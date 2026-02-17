# VaultMark - Project Guide

## Overview

VaultMark is a CLI tool for managing ephemeral credentials (SSH certificates and passwords) for secure AI-assisted development. It creates a local Certificate Authority, signs short-lived SSH certificates, and generates one-time passwords with full audit logging.

## Tech Stack

- **Language**: TypeScript (ES2022, ESM)
- **CLI Framework**: Commander.js
- **Terminal UI**: Chalk, Ora, cli-table3, Inquirer
- **SSH**: ssh-keygen (OpenSSH) for certificate signing, ssh2 for host provisioning
- **Database**: better-sqlite3 (credential tracking + audit log)
- **Encryption**: AES-256-GCM with scrypt KDF (Node.js crypto)
- **Linter/Formatter**: Biome
- **Tests**: Vitest
- **Build**: tsc + custom fix-imports.mjs script

## Project Structure

```
src/
├── cli.ts                      # Entry point with banner and command registration
├── commands/
│   ├── init.ts                 # Initialize Certificate Authority
│   ├── grant.ts                # Create ephemeral SSH certificate
│   ├── revoke.ts               # Revoke a credential
│   ├── list.ts                 # List credentials with TTL
│   ├── status.ts               # CA status and summary
│   ├── password.ts             # Generate ephemeral password
│   ├── setup-host.ts           # Configure remote host for CA trust
│   ├── cleanup.ts              # Force cleanup expired credentials
│   └── audit.ts                # Audit log viewer
├── core/
│   ├── ca.ts                   # Certificate Authority (init, sign, load keys)
│   ├── credential.ts           # Credential lifecycle orchestrator
│   ├── crypto.ts               # AES-256-GCM encryption + scrypt KDF
│   ├── database.ts             # SQLite schema + CRUD operations
│   ├── config.ts               # Paths, load/save config, ensureInitialized
│   ├── krl.ts                  # Key Revocation List management
│   ├── password-generator.ts   # Cryptographic password generation
│   └── ssh.ts                  # SSH host provisioning via ssh2
├── types/
│   ├── config.ts               # VaultMarkConfig, DefaultsConfig
│   ├── credential.ts           # Credential, AuditEntry, GrantOptions
│   └── ssh.ts                  # CAKeyPair, SSHCertificate, HostSetup
└── utils/
    ├── colors.ts               # Security theme (teal/green)
    ├── logger.ts               # Logger with security icons
    ├── errors.ts               # VaultMarkError hierarchy
    └── time.ts                 # TTL parsing, duration formatting
```

## Commands

- `vaultmark init` - Initialize CA (Ed25519 keypair, encrypted with passphrase)
- `vaultmark grant <host> -u <user>` - Create ephemeral SSH certificate
- `vaultmark revoke <id>` - Revoke credential and update KRL
- `vaultmark list` - List credentials with remaining TTL
- `vaultmark status` - Show CA info and credential counts
- `vaultmark password [label]` - Generate ephemeral password
- `vaultmark setup-host <host>` - Configure host to trust CA
- `vaultmark cleanup` - Force cleanup expired credentials
- `vaultmark audit` - View audit log

## Development

```bash
# Install dependencies
npm install

# Run in development
npm run dev [command]

# Build
npm run build

# Run tests
npm test

# Lint & format
npm run check
npm run format

# Install globally (for testing)
npm run install:global
```

## Storage

All data is stored locally in `~/.vaultmark/`:

```
~/.vaultmark/
├── config.yml              # Configuration (keyId, maxTTL, defaults)
├── ca/
│   ├── ca_key.enc          # AES-256-GCM encrypted CA private key
│   ├── ca_key.pub          # CA public key (OpenSSH format)
│   └── ca_key.salt         # Scrypt salt for key derivation
├── grants/<id>/            # Ephemeral keypairs + certificates
├── credentials.db          # SQLite (credentials + audit_log tables)
└── krl                     # Key Revocation List (binary)
```

## Security Model

- CA private key encrypted at rest (AES-256-GCM, scrypt N=16384)
- Passphrase prompted at each operation, never stored
- CA key zeroed from memory after use
- Certificates max TTL 24h, auto-cleanup on each command
- File permissions: 0700 dirs, 0600 private keys
- Passwords shown once, only SHA-256 hash stored for audit

## Code Style

- Use tabs for indentation
- Single quotes for strings
- Trailing commas (ES5 style)
- Always use semicolons
- Max line width: 100 characters

## Key Design Decisions

- **ssh-keygen over sshpk**: More reliable for certificate signing, available on all SSH-capable systems
- **SQLite over flat files**: Enables filtering, counting, and audit queries
- **scrypt over PBKDF2**: Better memory-hard resistance against brute force
- **Auto-cleanup**: Every command runs cleanup to expire stale credentials

---

## INSTRUCTIONS OBLIGATOIRES POUR L'IA (Claude Code)

> **IMPORTANT**: Cette section definit le comportement OBLIGATOIRE de l'IA lors du travail sur ce projet.

### Regle #1: TOUJOURS utiliser Backmark pour tracker le travail

```bash
backmark task create "<titre>" -a "@claude" -p <priorite> -l "<labels>"
backmark task ai-plan <id> "..."
backmark task edit <id> --status "In Progress"
```

### Regle #2: DOCUMENTER pendant l'implementation

```bash
backmark task ai-note <id> "**HH:MM** - <action>"
```

### Regle #3: AUTO-REVIEW avant de terminer

```bash
backmark task ai-review <id> "..."
backmark task close <id>
```

### Regle #4: Conventions

- Conventional Commits obligatoires
- Pas de reference a Claude/AI dans les commits
- Biome check doit passer avant tout commit
- Tests doivent passer avant tout commit
