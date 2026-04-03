import type {
	PortacallConversationListResponse,
	PortacallConversationMessagesResponse,
	PortacallConversationSummary,
} from "./types";

type PortacallProxyHandler = {
	configured: boolean;
	chat(
		agentId: string,
		message: string,
		externalUserId: string,
		conversationId?: string,
	): Promise<{ content: string; conversationId: string }>;
	createConversation(
		agentId: string,
		externalUserId: string,
		title?: string,
	): Promise<PortacallConversationSummary>;
	deleteConversation(
		agentId: string,
		conversationId: string,
		externalUserId: string,
	): Promise<void>;
	getConversationMessages(
		agentId: string,
		conversationId: string,
		externalUserId: string,
		options?: {
			limit?: number;
			offset?: number;
		},
	): Promise<PortacallConversationMessagesResponse>;
	openStream(
		agentId: string,
		message: string,
		externalUserId: string,
		conversationId?: string,
	): Promise<{ stream: ReadableStream<Uint8Array>; conversationId: string }>;
	listConversations(
		agentId: string,
		externalUserId: string,
		options?: {
			limit?: number;
			offset?: number;
			includeArchived?: boolean;
		},
	): Promise<PortacallConversationListResponse>;
	renameConversation(
		agentId: string,
		conversationId: string,
		externalUserId: string,
		title: string,
	): Promise<PortacallConversationSummary>;
	setConversationArchived(
		agentId: string,
		conversationId: string,
		externalUserId: string,
		archived: boolean,
	): Promise<PortacallConversationSummary>;
};

type RouteMatch =
	| {
			agentId: string;
			action: "health" | "chat" | "stream" | "conversations";
	  }
	| {
			agentId: string;
			conversationId: string;
			action: "conversation" | "conversationArchive" | "conversationMessages";
	  };

const STREAM_HEADERS = {
	"cache-control": "no-cache, no-transform",
	"content-type": "text/plain; charset=utf-8",
	"x-content-type-options": "nosniff",
};

export async function handlePortacallRequest(
	portacall: PortacallProxyHandler,
	request: Request,
): Promise<Response> {
	const url = new URL(request.url);
	const route = matchPortacallRoute(trimTrailingSlash(url.pathname));

	if (!route) {
		return json({ message: "Not found." }, 404);
	}

	if (route.action === "health") {
		return request.method === "GET"
			? json({ ok: true, configured: portacall.configured })
			: methodNotAllowed("GET");
	}

	if (!portacall.configured) {
		return missingConfiguration();
	}

	if (route.action === "conversations") {
		if (request.method === "GET") {
			const parsedQuery = readConversationListQuery(url.searchParams);
			if ("error" in parsedQuery) {
				return json({ message: parsedQuery.error }, 400);
			}

			try {
				return json(
					await portacall.listConversations(
						route.agentId,
						parsedQuery.externalUserId,
						{
							limit: parsedQuery.limit,
							offset: parsedQuery.offset,
							includeArchived: parsedQuery.includeArchived,
						},
					),
				);
			} catch (error) {
				return errorResponse(error);
			}
		}

		if (request.method === "POST") {
			const payload = await readConversationCreateInput(request);
			if ("error" in payload) {
				return json({ message: payload.error }, 400);
			}

			try {
				return json(
					{
						conversation: await portacall.createConversation(
							route.agentId,
							payload.externalUserId,
							payload.title,
						),
					},
					201,
				);
			} catch (error) {
				return errorResponse(error);
			}
		}

		return methodNotAllowed("GET, POST");
	}

	if (route.action === "conversationMessages") {
		if (request.method !== "GET") {
			return methodNotAllowed("GET");
		}

		const parsedQuery = readConversationMessagesQuery(url.searchParams);
		if ("error" in parsedQuery) {
			return json({ message: parsedQuery.error }, 400);
		}

		try {
			return json(
				await portacall.getConversationMessages(
					route.agentId,
					route.conversationId,
					parsedQuery.externalUserId,
					{
						limit: parsedQuery.limit,
						offset: parsedQuery.offset,
					},
				),
			);
		} catch (error) {
			return errorResponse(error);
		}
	}

	if (route.action === "conversation") {
		if (request.method === "PATCH") {
			const payload = await readConversationRenameInput(request);
			if ("error" in payload) {
				return json({ message: payload.error }, 400);
			}

			try {
				return json({
					conversation: await portacall.renameConversation(
						route.agentId,
						route.conversationId,
						payload.externalUserId,
						payload.title,
					),
				});
			} catch (error) {
				return errorResponse(error);
			}
		}

		if (request.method === "DELETE") {
			const externalUserId = readExternalUserId(url.searchParams);
			if (!externalUserId) {
				return json({ message: "External user ID is required." }, 400);
			}

			try {
				await portacall.deleteConversation(
					route.agentId,
					route.conversationId,
					externalUserId,
				);
				return json({
					id: route.conversationId,
					deleted: true,
				});
			} catch (error) {
				return errorResponse(error);
			}
		}

		return methodNotAllowed("PATCH, DELETE");
	}

	if (route.action === "conversationArchive") {
		if (request.method !== "PATCH") {
			return methodNotAllowed("PATCH");
		}

		const payload = await readConversationArchiveInput(request);
		if ("error" in payload) {
			return json({ message: payload.error }, 400);
		}

		try {
			return json({
				conversation: await portacall.setConversationArchived(
					route.agentId,
					route.conversationId,
					payload.externalUserId,
					payload.archived,
				),
			});
		} catch (error) {
			return errorResponse(error);
		}
	}

	if (route.action === "chat") {
		if (request.method !== "POST") {
			return methodNotAllowed("POST");
		}

		const payload = await readChatInput(request);
		if (!payload) {
			return json({ message: "Message is required." }, 400);
		}
		if ("error" in payload) {
			return json({ message: payload.error }, 400);
		}

		try {
			const response = await portacall.chat(
				route.agentId,
				payload.message,
				payload.externalUserId,
				payload.conversationId,
			);
			return json(response);
		} catch (error) {
			return errorResponse(error);
		}
	}

	if (route.action === "stream") {
		if (request.method !== "POST") {
			return methodNotAllowed("POST");
		}

		const payload = await readChatInput(request);
		if (!payload) {
			return json({ message: "Message is required." }, 400);
		}
		if ("error" in payload) {
			return json({ message: payload.error }, 400);
		}

		try {
			const response = await portacall.openStream(
				route.agentId,
				payload.message,
				payload.externalUserId,
				payload.conversationId,
			);
			return new Response(response.stream, {
				headers: {
					...STREAM_HEADERS,
					"x-portacall-conversation-id": response.conversationId,
				},
			});
		} catch (error) {
			return errorResponse(error);
		}
	}

	return json({ message: "Not found." }, 404);
}

async function readChatInput(request: Request): Promise<
	| {
			message: string;
			conversationId?: string;
			externalUserId: string;
	  }
	| { error: string }
	| null
> {
	const payload = (await request.json().catch(() => null)) as {
		message?: string;
		conversationId?: string;
		externalUserId?: string;
	} | null;
	const message = payload?.message?.trim();
	if (!message) {
		return null;
	}

	const conversationId = payload?.conversationId?.trim();
	const externalUserId = payload?.externalUserId?.trim();
	if (!externalUserId) {
		return { error: "External user ID is required." };
	}

	return {
		message,
		externalUserId,
		...(conversationId ? { conversationId } : {}),
	};
}

async function readConversationCreateInput(request: Request): Promise<
	| {
			externalUserId: string;
			title?: string;
	  }
	| { error: string }
> {
	const payload = (await request.json().catch(() => null)) as {
		externalUserId?: string;
		title?: string;
	} | null;
	const externalUserId = payload?.externalUserId?.trim();
	if (!externalUserId) {
		return { error: "External user ID is required." };
	}

	const title = payload?.title?.trim();
	if (payload?.title !== undefined && !title) {
		return { error: "Title is required." };
	}

	return {
		externalUserId,
		...(title ? { title } : {}),
	};
}

async function readConversationRenameInput(request: Request): Promise<
	| {
			externalUserId: string;
			title: string;
	  }
	| { error: string }
> {
	const payload = (await request.json().catch(() => null)) as {
		externalUserId?: string;
		title?: string;
	} | null;
	const externalUserId = payload?.externalUserId?.trim();
	if (!externalUserId) {
		return { error: "External user ID is required." };
	}

	const title = payload?.title?.trim();
	if (!title) {
		return { error: "Title is required." };
	}

	return {
		externalUserId,
		title,
	};
}

async function readConversationArchiveInput(request: Request): Promise<
	| {
			externalUserId: string;
			archived: boolean;
	  }
	| { error: string }
> {
	const payload = (await request.json().catch(() => null)) as {
		externalUserId?: string;
		archived?: boolean;
	} | null;
	const externalUserId = payload?.externalUserId?.trim();
	if (!externalUserId) {
		return { error: "External user ID is required." };
	}

	if (typeof payload?.archived !== "boolean") {
		return { error: "Archived must be a boolean." };
	}

	return {
		externalUserId,
		archived: payload.archived,
	};
}

function readConversationListQuery(searchParams: URLSearchParams):
	| {
			externalUserId: string;
			limit?: number;
			offset?: number;
			includeArchived?: boolean;
	  }
	| { error: string } {
	const externalUserId = readExternalUserId(searchParams);
	if (!externalUserId) {
		return { error: "External user ID is required." };
	}

	const limit = readOptionalPositiveInteger(searchParams.get("limit"), "Limit");
	if (typeof limit === "string") {
		return { error: limit };
	}

	const offset = readOptionalNonNegativeInteger(
		searchParams.get("offset"),
		"Offset",
	);
	if (typeof offset === "string") {
		return { error: offset };
	}

	const includeArchived = readOptionalBoolean(
		searchParams.get("includeArchived"),
	);
	if (typeof includeArchived === "string") {
		return { error: includeArchived };
	}

	return {
		externalUserId,
		...(limit !== undefined ? { limit } : {}),
		...(offset !== undefined ? { offset } : {}),
		...(includeArchived !== undefined ? { includeArchived } : {}),
	};
}

function readConversationMessagesQuery(searchParams: URLSearchParams):
	| {
			externalUserId: string;
			limit?: number;
			offset?: number;
	  }
	| { error: string } {
	const externalUserId = readExternalUserId(searchParams);
	if (!externalUserId) {
		return { error: "External user ID is required." };
	}

	const limit = readOptionalPositiveInteger(searchParams.get("limit"), "Limit");
	if (typeof limit === "string") {
		return { error: limit };
	}

	const offset = readOptionalNonNegativeInteger(
		searchParams.get("offset"),
		"Offset",
	);
	if (typeof offset === "string") {
		return { error: offset };
	}

	return {
		externalUserId,
		...(limit !== undefined ? { limit } : {}),
		...(offset !== undefined ? { offset } : {}),
	};
}

function readExternalUserId(searchParams: URLSearchParams): string | null {
	const value = searchParams.get("externalUserId")?.trim();
	return value || null;
}

function readOptionalPositiveInteger(
	value: string | null,
	label: string,
): number | string | undefined {
	if (value == null || value === "") {
		return undefined;
	}

	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
		return `${label} must be an integer between 1 and 100.`;
	}

	return parsed;
}

function readOptionalNonNegativeInteger(
	value: string | null,
	label: string,
): number | string | undefined {
	if (value == null || value === "") {
		return undefined;
	}

	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 0) {
		return `${label} must be a non-negative integer.`;
	}

	return parsed;
}

function readOptionalBoolean(
	value: string | null,
): boolean | string | undefined {
	if (value == null || value === "") {
		return undefined;
	}

	if (value === "true") {
		return true;
	}

	if (value === "false") {
		return false;
	}

	return "Include archived must be true or false.";
}

function missingConfiguration(): Response {
	return json(
		{
			message: "Missing Portacall configuration. Provide secretKey.",
		},
		500,
	);
}

function methodNotAllowed(method: string): Response {
	return new Response(JSON.stringify({ message: "Method not allowed." }), {
		status: 405,
		headers: {
			allow: method,
			"content-type": "application/json; charset=utf-8",
		},
	});
}

function errorResponse(error: unknown): Response {
	const status =
		error instanceof Error &&
		"status" in error &&
		typeof error.status === "number"
			? error.status
			: 500;
	const code =
		error instanceof Error && "code" in error && typeof error.code === "string"
			? error.code
			: undefined;
	const message =
		error instanceof Error ? error.message : "Unknown Portacall error.";

	return json({ message, code, status }, status);
}

function trimTrailingSlash(pathname: string): string {
	return pathname.length > 1 && pathname.endsWith("/")
		? pathname.slice(0, -1)
		: pathname;
}

function matchPortacallRoute(pathname: string): RouteMatch | null {
	const segments = pathname.split("/").filter(Boolean);
	if (segments.length < 4) {
		return null;
	}

	const [, , encodedAgentId, ...rest] = segments;
	if (!encodedAgentId) {
		return null;
	}

	try {
		const agentId = decodeURIComponent(encodedAgentId);

		if (rest.length === 1) {
			const [action] = rest;
			if (
				action === "health" ||
				action === "chat" ||
				action === "stream" ||
				action === "conversations"
			) {
				return { agentId, action };
			}
		}

		if (rest.length === 2 && rest[0] === "conversations" && rest[1]) {
			return {
				agentId,
				conversationId: decodeURIComponent(rest[1]),
				action: "conversation",
			};
		}

		if (
			rest.length === 3 &&
			rest[0] === "conversations" &&
			rest[1] &&
			rest[2]
		) {
			if (rest[2] === "messages") {
				return {
					agentId,
					conversationId: decodeURIComponent(rest[1]),
					action: "conversationMessages",
				};
			}

			if (rest[2] === "archive") {
				return {
					agentId,
					conversationId: decodeURIComponent(rest[1]),
					action: "conversationArchive",
				};
			}
		}

		return null;
	} catch {
		return null;
	}
}

function json(payload: unknown, status = 200): Response {
	return new Response(JSON.stringify(payload), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
		},
	});
}
