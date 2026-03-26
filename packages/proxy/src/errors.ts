export class PortacallError extends Error {
	readonly status: number;
	readonly code?: string;

	constructor(message: string, options: { status: number; code?: string }) {
		super(message);
		this.name = "PortacallError";
		this.status = options.status;
		this.code = options.code;
	}
}

export type PortacallErrorPayload = {
	message?: string;
	code?: string;
};
