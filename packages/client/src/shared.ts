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

export type ServerSentEventMessage = {
	event: string | null;
	data: string;
	id: string | null;
};

export async function* readServerSentEvents(
	stream: ReadableStream<Uint8Array>,
): AsyncIterable<ServerSentEventMessage> {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let buffer = "";

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				buffer += normalizeStreamChunk(decoder.decode());
				if (buffer) {
					const finalEvent = parseServerSentEvent(buffer);
					if (finalEvent) {
						yield finalEvent;
					}
				}
				return;
			}

			buffer += normalizeStreamChunk(decoder.decode(value, { stream: true }));

			let boundaryIndex = buffer.indexOf("\n\n");
			while (boundaryIndex >= 0) {
				const rawEvent = buffer.slice(0, boundaryIndex);
				buffer = buffer.slice(boundaryIndex + 2);
				const parsedEvent = parseServerSentEvent(rawEvent);
				if (parsedEvent) {
					yield parsedEvent;
				}
				boundaryIndex = buffer.indexOf("\n\n");
			}
		}
	} finally {
		reader.releaseLock();
	}
}

function normalizeStreamChunk(value: string): string {
	return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function parseServerSentEvent(value: string): ServerSentEventMessage | null {
	if (!value.trim()) {
		return null;
	}

	let event: string | null = null;
	let id: string | null = null;
	const data: string[] = [];

	for (const line of value.split("\n")) {
		if (!line || line.startsWith(":")) {
			continue;
		}

		const separatorIndex = line.indexOf(":");
		const field = separatorIndex === -1 ? line : line.slice(0, separatorIndex);
		const rawValue =
			separatorIndex === -1 ? "" : line.slice(separatorIndex + 1);
		const normalizedValue = rawValue.startsWith(" ")
			? rawValue.slice(1)
			: rawValue;

		if (field === "event") {
			event = normalizedValue || null;
			continue;
		}

		if (field === "data") {
			data.push(normalizedValue);
			continue;
		}

		if (field === "id") {
			id = normalizedValue || null;
		}
	}

	if (data.length === 0 && !event && !id) {
		return null;
	}

	return {
		event,
		data: data.join("\n"),
		id,
	};
}
