import { PortacallError, type PortacallErrorPayload } from "./errors";

export function normalizeMessage(message: string): string {
	const trimmedMessage = message.trim();
	if (!trimmedMessage) {
		throw new Error("Message is required.");
	}

	return trimmedMessage;
}

export async function createRequestError(
	response: Response,
	fallbackMessage: string,
): Promise<PortacallError> {
	const text = await response.text();
	if (!text) {
		return new PortacallError(fallbackMessage, { status: response.status });
	}

	try {
		const payload = JSON.parse(text) as PortacallErrorPayload;
		return new PortacallError(payload.message ?? fallbackMessage, {
			status: response.status,
			code: payload.code,
		});
	} catch {
		return new PortacallError(text, { status: response.status });
	}
}
