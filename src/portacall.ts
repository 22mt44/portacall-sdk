import { PortacallError, type PortacallErrorPayload } from "./errors";
import type { Portacall, PortacallOptions } from "./types";

const DEFAULT_BASE_URL = "https://api.portacall.ai";

type ChatResponse = {
	content: string;
};

export function portacall(options: PortacallOptions): Portacall {
	return {
		async chat(message: string): Promise<string> {
			const response = await requestAgent(options, "/chat", message);

			if (!response.ok) {
				throw await createRequestError(response, "Portacall request failed.");
			}

			const payload = (await response.json()) as ChatResponse;
			return payload.content;
		},
		stream(message: string): AsyncIterable<string> {
			return streamAgentResponse(options, message);
		},
	};
}

function createAgentURL(options: PortacallOptions, path: string): string {
	return new URL(
		`/api/agent/${options.agentId}${path}`,
		options.baseURL ?? DEFAULT_BASE_URL,
	).toString();
}

async function requestAgent(
	options: PortacallOptions,
	path: string,
	message: string,
): Promise<Response> {
	const trimmedMessage = message.trim();
	if (!trimmedMessage) {
		throw new Error("Message is required.");
	}

	const fetchImpl = options.fetch ?? globalThis.fetch;
	return fetchImpl(createAgentURL(options, path), {
		method: "POST",
		headers: {
			"content-type": "application/json; charset=utf-8",
			authorization: `Bearer ${options.secretKey}`,
			...options.headers,
		},
		body: JSON.stringify({ message: trimmedMessage }),
	});
}

async function* streamAgentResponse(
	options: PortacallOptions,
	message: string,
): AsyncIterable<string> {
	const response = await requestAgent(options, "/stream", message);

	if (!response.ok) {
		throw await createRequestError(response, "Portacall request failed.");
	}

	if (!response.body) {
		return;
	}

	yield* readTextStream(response.body);
}

async function* readTextStream(
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

async function createRequestError(
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
