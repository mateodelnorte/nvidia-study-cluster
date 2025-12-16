import pino from "pino";

const level = process.env.LOG_LEVEL || "info";

export const logger = pino({
	level,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

export function createChildLogger(name: string) {
	return logger.child({ module: name });
}
