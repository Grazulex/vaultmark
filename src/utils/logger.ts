import { colors, icons } from './colors';

export const logger = {
	success(message: string): void {
		console.log(`${colors.success(icons.success)} ${message}`);
	},

	error(message: string): void {
		console.error(`${colors.error(icons.error)} ${message}`);
	},

	warning(message: string): void {
		console.warn(`${colors.warning(icons.warning)} ${message}`);
	},

	info(message: string): void {
		console.log(`${colors.info(icons.info)} ${message}`);
	},

	secure(message: string): void {
		console.log(`${icons.lock} ${colors.secure(message)}`);
	},

	dim(message: string): void {
		console.log(colors.dim(message));
	},

	blank(): void {
		console.log();
	},
};
