import { handlePortacallRequest } from "./handler";
import { createRequestError, normalizeMessage } from "./shared";
import type {
	Portacall,
	PortacallConversationListResponse,
	PortacallOptions,
} from "./types";

const DEFAULT_BASE_URL = "https://api.portacall.ai";

type ChatResponse = {
	content: string;
	conversationId: string;
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
		const response = await requestPortacall(
			proxyOptions,
			agentId,
			"/chat",
			createChatRequestBody(message, externalUserId, conversationId),
		);

		if (!response.ok) {
			throw await createRequestError(response, "Portacall request failed.");
		}

		return (await response.json()) as ChatResponse;
	};

	const listConversations = async (
		agentId: string,
		externalUserId: string,
	): Promise<PortacallConversationListResponse> => {
		const response = await requestPortacall(
			proxyOptions,
			agentId,
			"/conversations",
			undefined,
			{
				externalUserId: normalizeRequiredExternalUserId(externalUserId),
			},
		);

		if (!response.ok) {
			throw await createRequestError(response, "Portacall request failed.");
		}

		return (await response.json()) as PortacallConversationListResponse;
	};

	return {
		handler(request: Request): Promise<Response> {
			return handlePortacallRequest(
				{
					configured,
					chat,
					openStream: (agentId, message, externalUserId, conversationId) =>
						openStream(
							proxyOptions,
							agentId,
							message,
							externalUserId,
							conversationId,
						),
					listConversations,
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
	searchParams?: Record<string, string>,
): string {
	const url = new URL(
		`/api/portacall/${encodeURIComponent(agentId)}${path}`,
		options.baseURL ?? DEFAULT_BASE_URL,
	);
	for (const [key, value] of Object.entries(searchParams ?? {})) {
		url.searchParams.set(key, value);
	}

	return url.toString();
}

async function requestPortacall(
	options: PortacallOptions & { secretKey: string },
	agentId: string,
	path: string,
	body?: ChatRequestBody,
	searchParams?: Record<string, string>,
): Promise<Response> {
	const fetchImpl = options.fetch ?? globalThis.fetch;
	return fetchImpl(createPortacallURL(options, agentId, path, searchParams), {
		method: body ? "POST" : "GET",
		headers: {
			...(body ? { "content-type": "application/json; charset=utf-8" } : {}),
			authorization: `Bearer ${options.secretKey}`,
			...options.headers,
		},
		...(body ? { body: JSON.stringify(body) } : {}),
	});
}

async function openStream(
	options: PortacallOptions & { secretKey: string },
	agentId: string,
	message: string,
	externalUserId: string,
	conversationId?: string,
): Promise<{ stream: ReadableStream<Uint8Array>; conversationId: string }> {
	const response = await requestPortacall(
		options,
		agentId,
		"/stream",
		createChatRequestBody(message, externalUserId, conversationId),
	);

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

function normalizeRequiredExternalUserId(
	externalUserId: string | null | undefined,
): string {
	const value = externalUserId?.trim();
	if (!value) {
		throw new Error("External user ID is required.");
	}

	return value;
}
