import { PortacallError } from "./errors";
import { createRequestError, normalizeMessage, readTextStream } from "./shared";

const DEFAULT_BACKEND_URL = "";

type ChatResponse = {
	content: string;
	conversationId: string;
};

export type PortacallChatOptions = {
	conversationId?: string | null;
};

export type PortacallStreamOptions = {
	conversationId?: string | null;
	onConversationId?: (conversationId: string) => void;
};

export type { PortacallErrorPayload } from "./errors";
export { PortacallError } from "./errors";

export type PortacallClientFetch = (
	input: RequestInfo | URL,
	init?: RequestInit,
) => Promise<Response>;

export type PortacallClientOptions = {
	headers?: Record<string, string>;
	fetch?: PortacallClientFetch;
};

export type PortacallClientHealth = {
	ok: boolean;
	configured: boolean;
};

export type PortacallClient = {
	agentId: string;
	backendURL: string;
	baseURL: string;
	readonly conversationId: string | null;
	resetConversation(): void;
	health(): Promise<PortacallClientHealth>;
	chat(message: string, options?: PortacallChatOptions): Promise<string>;
	stream(
		message: string,
		options?: PortacallStreamOptions,
	): AsyncIterable<string>;
};

export function portacall(
	backendURL: string | undefined,
	agentId: string,
	options: PortacallClientOptions = {},
): PortacallClient {
	const normalizedAgentId = normalizeAgentId(agentId);
	const normalizedBackendURL = normalizeBackendURL(backendURL);
	const baseURL = createBaseURL(normalizedBackendURL, normalizedAgentId);
	let currentConversationId: string | null = null;

	return {
		agentId: normalizedAgentId,
		backendURL: normalizedBackendURL,
		baseURL,
		get conversationId() {
			return currentConversationId;
		},
		resetConversation(): void {
			currentConversationId = null;
		},
		async health(): Promise<PortacallClientHealth> {
			const response = await request(baseURL, options, "/health");

			if (!response.ok) {
				throw await createRequestError(response, "Portacall request failed.");
			}

			return (await response.json()) as PortacallClientHealth;
		},
		async chat(
			message: string,
			chatOptions: PortacallChatOptions = {},
		): Promise<string> {
			const response = await request(baseURL, options, "/chat", {
				message: normalizeMessage(message),
				conversationId: resolveConversationId(
					chatOptions.conversationId,
					currentConversationId,
				),
			});

			if (!response.ok) {
				throw await createRequestError(response, "Portacall request failed.");
			}

			const payload = (await response.json()) as ChatResponse;
			currentConversationId = payload.conversationId;
			return payload.content;
		},
		async *stream(
			message: string,
			streamOptions: PortacallStreamOptions = {},
		): AsyncIterable<string> {
			const response = await request(baseURL, options, "/stream", {
				message: normalizeMessage(message),
				conversationId: resolveConversationId(
					streamOptions.conversationId,
					currentConversationId,
				),
			});

			if (!response.ok) {
				throw await createRequestError(response, "Portacall request failed.");
			}

			if (!response.body) {
				throw new PortacallError("Portacall stream body is empty.", {
					status: 500,
				});
			}

			const conversationId =
				response.headers.get("x-portacall-conversation-id")?.trim() ?? "";
			if (conversationId) {
				currentConversationId = conversationId;
				streamOptions.onConversationId?.(conversationId);
			}

			yield* readTextStream(response.body);
		},
	};
}

async function request(
	baseURL: string,
	options: PortacallClientOptions,
	path: string,
	body?: { message: string; conversationId?: string },
): Promise<Response> {
	const fetchImpl = options.fetch ?? globalThis.fetch;
	return fetchImpl(createURL(baseURL, path), {
		method: body ? "POST" : "GET",
		headers: {
			...(body ? { "content-type": "application/json; charset=utf-8" } : {}),
			...options.headers,
		},
		...(body ? { body: JSON.stringify(body) } : {}),
	});
}

function resolveConversationId(
	explicitConversationId: string | null | undefined,
	currentConversationId: string | null,
): string | undefined {
	const value = explicitConversationId?.trim();
	if (value) {
		return value;
	}

	return currentConversationId ?? undefined;
}

function normalizeAgentId(agentId: string): string {
	const value = agentId.trim();
	if (!value) {
		throw new Error("Agent ID is required.");
	}

	return value;
}

function normalizeBackendURL(backendURL: string | undefined): string {
	const value = backendURL?.trim() ?? DEFAULT_BACKEND_URL;
	return stripTrailingSlash(value);
}

function createBaseURL(backendURL: string, agentId: string): string {
	const agentPath = `api/portacall/${encodeURIComponent(agentId)}`;
	if (/^https?:\/\//.test(backendURL)) {
		return new URL(agentPath, `${backendURL}/`).toString().replace(/\/$/, "");
	}

	if (!backendURL) {
		return `/${agentPath}`;
	}

	return `${backendURL}/${agentPath}`;
}

function createURL(baseURL: string, path: string): string {
	if (/^https?:\/\//.test(baseURL)) {
		return new URL(stripLeadingSlash(path), `${baseURL}/`).toString();
	}

	return `${stripTrailingSlash(baseURL)}${path}`;
}

function stripLeadingSlash(value: string): string {
	return value.startsWith("/") ? value.slice(1) : value;
}

function stripTrailingSlash(value: string): string {
	return value.endsWith("/") ? value.slice(0, -1) : value;
}
