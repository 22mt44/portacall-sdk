import { handlePortacallRequest } from "./handler";
import { createRequestError, normalizeMessage } from "./shared";
import type { Portacall, PortacallOptions } from "./types";

const DEFAULT_BASE_URL = "https://api.portacall.ai";

type ChatResponse = {
	content: string;
};

export function portacall(options: PortacallOptions): Portacall {
	const agentId = options.agentId.trim();
	const secretKey = options.secretKey.trim();
	const requestOptions = {
		...options,
		agentId,
		secretKey,
	};
	const configured = agentId.length > 0 && secretKey.length > 0;
	const chat = async (message: string): Promise<string> => {
		const response = await requestAgent(requestOptions, "/chat", message);

		if (!response.ok) {
			throw await createRequestError(response, "Portacall request failed.");
		}

		const payload = (await response.json()) as ChatResponse;
		return payload.content;
	};

	return {
		agentId,
		handler(request: Request): Promise<Response> {
			return handlePortacallRequest(
				{
					agentId,
					configured,
					chat,
					openStream: (message) => openStream(requestOptions, message),
				},
				request,
			);
		},
	};
}

function createAgentURL(options: PortacallOptions, path: string): string {
	return new URL(
		`/api/agent/${encodeURIComponent(options.agentId)}${path}`,
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
