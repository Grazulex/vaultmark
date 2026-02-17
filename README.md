# VaultMark

Ephemeral credential manager for secure AI-assisted development.

VaultMark creates **temporary SSH certificates** and **ephemeral passwords** that auto-expire after a configurable TTL. No more sharing long-lived credentials in chat or code.

## Features

- **SSH Certificate Authority** - Ed25519 CA with encrypted private key (AES-256-GCM + scrypt)
- **Ephemeral SSH Certificates** - Signed by your CA, auto-expire (max 24h)
- **Ephemeral Passwords** - Cryptographically random, shown once, hash stored for audit
- **Key Revocation List** - Instant revocation via KRL
- **Audit Log** - Full audit trail of all operations
- **Auto-cleanup** - Expired credentials are automatically purged
- **Zero trust** - CA passphrase never stored, keys zeroed from memory

## Installation

```bash
npm install -g @grazulex/vaultmark
```

**Requirements:** Node.js 18+, OpenSSH (`ssh-keygen`)

## Quick Start

```bash
# 1. Initialize the Certificate Authority
vaultmark init

# 2. Configure a remote host to trust your CA
vaultmark setup-host myserver.com -u root -i ~/.ssh/id_ed25519

# 3. Create an ephemeral SSH access (1 hour default)
vaultmark grant myserver.com -u deploy -t 1h

# 4. Use the generated SSH command
ssh -i "~/.vaultmark/grants/<id>/id_ed25519" \
    -o CertificateFile="~/.vaultmark/grants/<id>/id_ed25519-cert.pub" \
    deploy@myserver.com

# 5. Revoke early if needed
vaultmark revoke <id>
```

## Commands

### `vaultmark init`

Initialize the Certificate Authority. Generates an Ed25519 keypair, encrypts the private key with your passphrase.

```bash
vaultmark init
vaultmark init --passphrase "..." --key-id "my-ca"
vaultmark init --force  # Reinitialize (invalidates all certs)
```

### `vaultmark grant <host> -u <user>`

Create an ephemeral SSH certificate signed by your CA.

```bash
vaultmark grant myserver.com -u deploy
vaultmark grant myserver.com -u deploy -t 30m
vaultmark grant myserver.com -u deploy --force-command "ls /var/log"
```

### `vaultmark revoke <id>`

Immediately revoke a credential. Deletes key files and updates the KRL.

```bash
vaultmark revoke abc12345
vaultmark revoke abc12345 --yes  # Skip confirmation
```

### `vaultmark list`

List credentials with remaining TTL.

```bash
vaultmark list
vaultmark list --all           # Include expired/revoked
vaultmark list --type ssh-cert
vaultmark list --host myserver.com
```

### `vaultmark status`

Show CA info and credential summary.

### `vaultmark password [label]`

Generate an ephemeral password.

```bash
vaultmark password "db-root" -t 10m
vaultmark password "api-key" -l 64 --charset special
vaultmark password --copy  # Copy to clipboard
```

### `vaultmark setup-host <host>`

Configure a remote host to trust your CA (adds TrustedUserCAKeys to sshd_config).

```bash
vaultmark setup-host myserver.com -u root
vaultmark setup-host myserver.com --dry-run  # Preview commands
```

### `vaultmark cleanup`

Force cleanup of expired credentials.

### `vaultmark audit`

View the audit log.

```bash
vaultmark audit
vaultmark audit -n 50
vaultmark audit --action grant
vaultmark audit --json
```

## Security Model

- **CA private key** is encrypted with AES-256-GCM using scrypt key derivation
- **Passphrase** is prompted at each operation, never stored on disk
- **Certificates** are ephemeral with a maximum TTL of 24 hours
- **KRL** (Key Revocation List) is updated on every revocation
- **Passwords** are displayed once; only a SHA-256 hash is stored for audit
- **File permissions**: 0700 for directories, 0600 for private keys
- **Memory safety**: CA key is zeroed from memory after use

## Storage

```
~/.vaultmark/
├── config.yml              # Configuration
├── ca/
│   ├── ca_key.enc          # Encrypted CA private key
│   ├── ca_key.pub          # CA public key
│   └── ca_key.salt         # Scrypt salt
├── grants/
│   └── <id>/               # Ephemeral keypair + certificate
├── credentials.db          # SQLite (credentials + audit)
└── krl                     # Key Revocation List
```

## Part of the *Mark Ecosystem

- [Backmark](https://www.backmark.tech/) - Task management for AI dev
- [Stackmark](https://www.stackmark.tech/) - Docker environments
- [Shipmark](https://www.shipmark.tech/) - Releases and versioning
- [EnvMark](https://www.envmark.tech/) - Environment variables
- [ContextMark](https://contextmark.tech/) - Claude Code contexts

## License

MIT
