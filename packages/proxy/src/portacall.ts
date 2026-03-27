import { handlePortacallRequest } from "./handler";
import { createRequestError, normalizeMessage } from "./shared";
import type { Portacall, PortacallOptions } from "./types";

const DEFAULT_BASE_URL = "https://api.portacall.ai";

type ChatResponse = {
	content: string;
};

export function portacall(
	secretKey: string,
	options: PortacallOptions = {},
): Portacall {
	const normalizedSecretKey = secretKey.trim();
	const configured = normalizedSecretKey.length > 0;
	const requestOptions = {
		...options,
		secretKey: normalizedSecretKey,
	};
	const chat = async (agentId: string, message: string): Promise<string> => {
		const response = await requestAgent(
			requestOptions,
			agentId,
			"/chat",
			message,
		);

		if (!response.ok) {
			throw await createRequestError(response, "Portacall request failed.");
		}

		const payload = (await response.json()) as ChatResponse;
		return payload.content;
	};

	return {
		handler(request: Request): Promise<Response> {
			return handlePortacallRequest(
				{
					configured,
					chat,
					openStream: (agentId, message) =>
						openStream(requestOptions, agentId, message),
				},
				request,
			);
		},
	};
}

function createAgentURL(
	options: PortacallOptions & { secretKey: string },
	agentId: string,
	path: string,
): string {
	return new URL(
		`/api/portacall/${encodeURIComponent(agentId)}${path}`,
		options.baseURL ?? DEFAULT_BASE_URL,
	).toString();
}

async function requestAgent(
	options: PortacallOptions & { secretKey: string },
	agentId: string,
	path: string,
	message: string,
): Promise<Response> {
	const fetchImpl = options.fetch ?? globalThis.fetch;
	return fetchImpl(createAgentURL(options, agentId, path), {
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
	options: PortacallOptions & { secretKey: string },
	agentId: string,
	message: string,
): Promise<ReadableStream<Uint8Array>> {
	const response = await requestAgent(options, agentId, "/stream", message);

	if (!response.ok) {
		throw await createRequestError(response, "Portacall request failed.");
	}

	if (!response.body) {
		throw new Error("Portacall stream body is empty.");
	}

	return response.body;
}
