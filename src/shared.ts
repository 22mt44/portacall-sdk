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

export async function* readTextStream(
	stream: ReadableStream<Uint8Array>,
): AsyncIterable<string> {
	const reader = stream.getReader();
	const decoder = new TextDecoder();

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				const finalChunk = decoder.decode();
				if (finalChunk) {
					yield finalChunk;
				}

				return;
			}

			const chunk = decoder.decode(value, { stream: true });
			if (chunk) {
				yield chunk;
			}
		}
	} finally {
		reader.releaseLock();
	}
}
