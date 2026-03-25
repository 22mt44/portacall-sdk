import { handlePortacallRequest } from "./handler";
import { createRequestError, normalizeMessage, readTextStream } from "./shared";
import type { Portacall, PortacallOptions } from "./types";

const DEFAULT_BASE_URL = "https://api.portacall.ai";

type ChatResponse = {
	content: string;
};

export function portacall(options: PortacallOptions): Portacall {
	const configured =
		options.agentId.trim().length > 0 && options.secretKey.trim().length > 0;
	const chat = async (message: string): Promise<string> => {
		const response = await requestAgent(options, "/chat", message);

		if (!response.ok) {
			throw await createRequestError(response, "Portacall request failed.");
		}

		const payload = (await response.json()) as ChatResponse;
		return payload.content;
	};
	const stream = (message: string): AsyncIterable<string> =>
		streamAgentResponse(options, message);

	return {
		chat,
		stream(message: string): AsyncIterable<string> {
			return stream(message);
		},
		handler(request: Request): Promise<Response> {
			return handlePortacallRequest(
				{
					configured,
					chat,
					openStream: (message) => openStream(options, message),
				},
				request,
			);
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
	const fetchImpl = options.fetch ?? globalThis.fetch;
	return fetchImpl(createAgentURL(options, path), {
		method: "POST",
		headers: {
			"content-type": "application/json; charset=utf-8",
			authorization: `Bearer ${options.secretKey}`,
			...options.headers,
		},
		body: JSON.stringify({ message: normalizeMessage(message) }),
	});
}

async function* streamAgentResponse(
	options: PortacallOptions,
	message: string,
): AsyncIterable<string> {
	yield* readTextStream(await openStream(options, message));
}

async function openStream(
	options: PortacallOptions,
	message: string,
): Promise<ReadableStream<Uint8Array>> {
	const response = await requestAgent(options, "/stream", message);

	if (!response.ok) {
		throw await createRequestError(response, "Portacall request failed.");
	}

	if (!response.body) {
		throw new Error("Portacall stream body is empty.");
	}

	return response.body;
}
