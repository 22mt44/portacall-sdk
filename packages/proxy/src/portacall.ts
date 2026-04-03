import { handlePortacallRequest } from "./handler";
import { createRequestError, normalizeMessage } from "./shared";
import type {
	Portacall,
	PortacallConversationListResponse,
	PortacallConversationMessagesResponse,
	PortacallConversationSummary,
	PortacallOptions,
} from "./types";

const DEFAULT_BASE_URL = "https://api.portacall.ai";

type ChatResponse = {
	content: string;
	conversationId: string;
	events: Array<{
		type:
			| "conversation_id"
			| "text_delta"
			| "tool_call_started"
			| "tool_call_completed"
			| "tool_call_failed"
			| "message_completed";
		[key: string]: unknown;
	}>;
};

type PortacallConversationResponse = {
	conversation: PortacallConversationSummary;
};

type ChatRequestBody = {
	message: string;
	externalUserId: string;
	conversationId?: string;
};

export function portacall(
	secretKey: string,
	options: PortacallOptions = {},
): Portacall {
	const normalizedSecretKey = secretKey.trim();
	const configured = normalizedSecretKey.length > 0;
	const proxyOptions = {
		...options,
		secretKey: normalizedSecretKey,
	};
	const chat = async (
		agentId: string,
		message: string,
		externalUserId: string,
		conversationId?: string,
	): Promise<ChatResponse> => {
		const response = await requestPortacall(proxyOptions, agentId, "/chat", {
			body: createChatRequestBody(message, externalUserId, conversationId),
		});

		if (!response.ok) {
			throw await createRequestError(response, "Portacall request failed.");
		}

		return (await response.json()) as ChatResponse;
	};

	const createConversation = async (
		agentId: string,
		externalUserId: string,
		title?: string,
	): Promise<PortacallConversationSummary> => {
		const response = await requestPortacall(
			proxyOptions,
			agentId,
			"/conversations",
			{
				body: {
					externalUserId: normalizeRequiredExternalUserId(externalUserId),
					...(title ? { title: normalizeRequiredTitle(title) } : {}),
				},
			},
		);

		if (!response.ok) {
			throw await createRequestError(response, "Portacall request failed.");
		}

		const payload = (await response.json()) as PortacallConversationResponse;
		return payload.conversation;
	};

	const listConversations = async (
		agentId: string,
		externalUserId: string,
		options: {
			limit?: number;
			offset?: number;
			includeArchived?: boolean;
		} = {},
	): Promise<PortacallConversationListResponse> => {
		const response = await requestPortacall(
			proxyOptions,
			agentId,
			"/conversations",
			{
				searchParams: {
					externalUserId: normalizeRequiredExternalUserId(externalUserId),
					limit: normalizeOptionalLimit(options.limit),
					offset: normalizeOptionalOffset(options.offset),
					includeArchived: options.includeArchived,
				},
			},
		);

		if (!response.ok) {
			throw await createRequestError(response, "Portacall request failed.");
		}

		return (await response.json()) as PortacallConversationListResponse;
	};

	const getConversationMessages = async (
		agentId: string,
		conversationId: string,
		externalUserId: string,
		options: {
			limit?: number;
			offset?: number;
		} = {},
	): Promise<PortacallConversationMessagesResponse> => {
		const response = await requestPortacall(
			proxyOptions,
			agentId,
			`/conversations/${encodeURIComponent(normalizeConversationId(conversationId))}/messages`,
			{
				searchParams: {
					externalUserId: normalizeRequiredExternalUserId(externalUserId),
					limit: normalizeOptionalLimit(options.limit),
					offset: normalizeOptionalOffset(options.offset),
				},
			},
		);

		if (!response.ok) {
			throw await createRequestError(response, "Portacall request failed.");
		}

		return (await response.json()) as PortacallConversationMessagesResponse;
	};

	const renameConversation = async (
		agentId: string,
		conversationId: string,
		externalUserId: string,
		title: string,
	): Promise<PortacallConversationSummary> => {
		const response = await requestPortacall(
			proxyOptions,
			agentId,
			`/conversations/${encodeURIComponent(normalizeConversationId(conversationId))}`,
			{
				method: "PATCH",
				body: {
					externalUserId: normalizeRequiredExternalUserId(externalUserId),
					title: normalizeRequiredTitle(title),
				},
			},
		);

		if (!response.ok) {
			throw await createRequestError(response, "Portacall request failed.");
		}

		const payload = (await response.json()) as PortacallConversationResponse;
		return payload.conversation;
	};

	const setConversationArchived = async (
		agentId: string,
		conversationId: string,
		externalUserId: string,
		archived: boolean,
	): Promise<PortacallConversationSummary> => {
		const response = await requestPortacall(
			proxyOptions,
			agentId,
			`/conversations/${encodeURIComponent(normalizeConversationId(conversationId))}/archive`,
			{
				method: "PATCH",
				body: {
					externalUserId: normalizeRequiredExternalUserId(externalUserId),
					archived,
				},
			},
		);

		if (!response.ok) {
			throw await createRequestError(response, "Portacall request failed.");
		}

		const payload = (await response.json()) as PortacallConversationResponse;
		return payload.conversation;
	};

	const deleteConversation = async (
		agentId: string,
		conversationId: string,
		externalUserId: string,
	): Promise<void> => {
		const response = await requestPortacall(
			proxyOptions,
			agentId,
			`/conversations/${encodeURIComponent(normalizeConversationId(conversationId))}`,
			{
				method: "DELETE",
				searchParams: {
					externalUserId: normalizeRequiredExternalUserId(externalUserId),
				},
			},
		);

		if (!response.ok) {
			throw await createRequestError(response, "Portacall request failed.");
		}
	};

	return {
		handler(request: Request): Promise<Response> {
			return handlePortacallRequest(
				{
					configured,
					chat,
					createConversation,
					deleteConversation,
					getConversationMessages,
					listConversations,
					openStream: (agentId, message, externalUserId, conversationId) =>
						openStream(
							proxyOptions,
							agentId,
							message,
							externalUserId,
							conversationId,
						),
					renameConversation,
					setConversationArchived,
				},
				request,
			);
		},
	};
}

function createPortacallURL(
	options: PortacallOptions & { secretKey: string },
	agentId: string,
	path: string,
	searchParams?: Record<string, boolean | number | string | undefined>,
): string {
	const url = new URL(
		`/api/portacall/${encodeURIComponent(agentId)}${path}`,
		options.baseURL ?? DEFAULT_BASE_URL,
	);
	for (const [key, value] of Object.entries(searchParams ?? {})) {
		if (value === undefined) {
			continue;
		}

		url.searchParams.set(key, String(value));
	}

	return url.toString();
}

async function requestPortacall(
	options: PortacallOptions & { secretKey: string },
	agentId: string,
	path: string,
	requestOptions: {
		method?: "DELETE" | "GET" | "PATCH" | "POST";
		body?: Record<string, boolean | number | string | undefined>;
		headers?: Record<string, string>;
		searchParams?: Record<string, boolean | number | string | undefined>;
	} = {},
): Promise<Response> {
	const fetchImpl = options.fetch ?? globalThis.fetch;
	const method =
		requestOptions.method ?? (requestOptions.body ? "POST" : "GET");

	return fetchImpl(
		createPortacallURL(options, agentId, path, requestOptions.searchParams),
		{
			method,
			headers: {
				...(requestOptions.body
					? { "content-type": "application/json; charset=utf-8" }
					: {}),
				authorization: `Bearer ${options.secretKey}`,
				...requestOptions.headers,
				...options.headers,
			},
			...(requestOptions.body
				? {
						body: JSON.stringify(stripUndefinedProperties(requestOptions.body)),
					}
				: {}),
		},
	);
}

async function openStream(
	options: PortacallOptions & { secretKey: string },
	agentId: string,
	message: string,
	externalUserId: string,
	conversationId?: string,
): Promise<{
	stream: ReadableStream<Uint8Array>;
	conversationId: string;
	responseHeaders: Record<string, string>;
}> {
	const response = await requestPortacall(options, agentId, "/stream", {
		body: createChatRequestBody(message, externalUserId, conversationId),
		headers: {
			accept: "text/event-stream",
		},
	});

	if (!response.ok) {
		throw await createRequestError(response, "Portacall request failed.");
	}

	if (!response.body) {
		throw new Error("Portacall stream body is empty.");
	}

	const resolvedConversationId =
		response.headers.get("x-portacall-conversation-id")?.trim() ?? "";
	if (!resolvedConversationId) {
		throw new Error("Portacall conversation ID header is missing.");
	}

	return {
		stream: response.body,
		conversationId: resolvedConversationId,
		responseHeaders: createStreamResponseHeaders(response.headers),
	};
}

function createStreamResponseHeaders(headers: Headers): Record<string, string> {
	return {
		"cache-control":
			headers.get("cache-control")?.trim() ?? "no-cache, no-transform",
		"content-type":
			headers.get("content-type")?.trim() ?? "text/event-stream; charset=utf-8",
		"x-content-type-options":
			headers.get("x-content-type-options")?.trim() ?? "nosniff",
	};
}

function createChatRequestBody(
	message: string,
	externalUserId: string,
	conversationId?: string,
): ChatRequestBody {
	return {
		message: normalizeMessage(message),
		externalUserId: normalizeRequiredExternalUserId(externalUserId),
		...(conversationId ? { conversationId } : {}),
	};
}

function normalizeConversationId(
	conversationId: string | null | undefined,
): string {
	const value = conversationId?.trim();
	if (!value) {
		throw new Error("Conversation ID is required.");
	}

	return value;
}

function normalizeRequiredExternalUserId(
	externalUserId: string | null | undefined,
): string {
	const value = externalUserId?.trim();
	if (!value) {
		throw new Error("External user ID is required.");
	}

	return value;
}

function normalizeRequiredTitle(title: string | null | undefined): string {
	const value = title?.trim();
	if (!value) {
		throw new Error("Title is required.");
	}

	return value;
}

function normalizeOptionalLimit(limit: number | undefined): number | undefined {
	if (limit === undefined) {
		return undefined;
	}

	if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
		throw new Error("Limit must be an integer between 1 and 100.");
	}

	return limit;
}

function normalizeOptionalOffset(
	offset: number | undefined,
): number | undefined {
	if (offset === undefined) {
		return undefined;
	}

	if (!Number.isInteger(offset) || offset < 0) {
		throw new Error("Offset must be a non-negative integer.");
	}

	return offset;
}

function stripUndefinedProperties(
	value: Record<string, boolean | number | string | undefined>,
): Record<string, boolean | number | string> {
	return Object.fromEntries(
		Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
	) as Record<string, boolean | number | string>;
}
