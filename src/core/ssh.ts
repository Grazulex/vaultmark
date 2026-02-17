import { readFileSync } from 'node:fs';
import { Client } from 'ssh2';
import type { HostSetupOptions, HostSetupResult, HostSetupStep } from '../types/ssh';
import { SSHError } from '../utils/errors';
import { getCAPublicKey } from './ca';
import { paths } from './config';

export async function setupHost(options: HostSetupOptions): Promise<HostSetupResult> {
	const caPublicKey = getCAPublicKey();
	const steps: HostSetupStep[] = [];

	const commands = [
		{
			description: 'Add CA public key to TrustedUserCAKeys',
			command: `echo '${caPublicKey}' | sudo tee -a /etc/ssh/trusted_ca_keys > /dev/null`,
		},
		{
			description: 'Configure sshd to trust the CA',
			command: `sudo grep -q 'TrustedUserCAKeys' /etc/ssh/sshd_config || echo 'TrustedUserCAKeys /etc/ssh/trusted_ca_keys' | sudo tee -a /etc/ssh/sshd_config > /dev/null`,
		},
		{
			description: 'Reload SSH daemon',
			command: 'sudo systemctl reload sshd || sudo service ssh reload',
		},
	];

	if (options.dryRun) {
		for (const cmd of commands) {
			steps.push({ ...cmd, success: true });
		}
		return { success: true, steps };
	}

	return new Promise((resolve, reject) => {
		const conn = new Client();

		const connectConfig: any = {
			host: options.host,
			port: options.port,
			username: options.user,
		};

		if (options.identityFile) {
			connectConfig.privateKey = readFileSync(options.identityFile);
		} else {
			connectConfig.agent = process.env.SSH_AUTH_SOCK;
		}

		conn.on('ready', async () => {
			let allSuccess = true;

			for (const cmd of commands) {
				const step = await executeSSHCommand(conn, cmd.description, cmd.command);
				steps.push(step);
				if (!step.success) {
					allSuccess = false;
					break;
				}
			}

			conn.end();
			resolve({ success: allSuccess, steps });
		});

		conn.on('error', (err) => {
			reject(
				new SSHError(`Failed to connect to ${options.host}: ${err.message}`, [
					'Check that the host is reachable',
					'Verify your SSH credentials',
					'Use -i to specify an identity file',
				])
			);
		});

		conn.connect(connectConfig);
	});
}

function executeSSHCommand(
	conn: Client,
	description: string,
	command: string
): Promise<HostSetupStep> {
	return new Promise((resolve) => {
		conn.exec(command, (err, stream) => {
			if (err) {
				resolve({ description, command, success: false, error: err.message });
				return;
			}

			let stderr = '';

			stream.on('close', (code: number) => {
				resolve({
					description,
					command,
					success: code === 0,
					error: code !== 0 ? stderr.trim() || `Exit code: ${code}` : undefined,
				});
			});

			stream.stderr.on('data', (data: Buffer) => {
				stderr += data.toString();
			});
		});
	});
}
