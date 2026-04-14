import {
	createPortacallAuthHandoff,
	readPortacallAuthHandoff,
} from "./auth-handoff";
import { handlePortacallRequest } from "./handler";
import { createRequestError, isRecord, normalizeMessage } from "./shared";
import type {
	PortacallAgent,
	PortacallAuthAdapter,
	PortacallConversationListResponse,
	PortacallConversationMessagesResponse,
	PortacallConversationSummary,
	PortacallOptions,
	PortacallRegisteredTool,
	PortacallServer,
	PortacallServerOptions,
	PortacallToolDefinition,
	PortacallToolHandler,
	PortacallToolRunCompleteBody,
	PortacallToolRunCompleteResponse,
	PortacallToolRunListResponse,
	PortacallToolRunResolveResponse,
	PortacallToolSyncRequest,
	PortacallToolSyncResponse,
} from "./types";
import {
	handlePortacallWebhook,
	type PortacallToolWebhookEvent,
	type PortacallToolWebhookResponse,
} from "./webhooks";

const DEFAULT_BASE_URL = "https://api.portacall.ai";
const DEFAULT_AUTH_HANDOFF_TTL_SECONDS = 300;
const AUTH_HANDOFF_HEADER = "x-portacall-auth-handoff";

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

type RegisteredToolInternal<RestoredAuth> = PortacallRegisteredTool & {
	execute: PortacallToolHandler<RestoredAuth>;
};

export function createPortacallServer<
	AuthContext extends Record<string, unknown> = Record<string, unknown>,
	RestoredAuth = unknown,
>(
	options: PortacallServerOptions<AuthContext, RestoredAuth>,
): PortacallServer<RestoredAuth> {
	const normalizedSecretKey = options.secretKey.trim();
	const configured = normalizedSecretKey.length > 0;
	const handoffSecret =
		options.handoffSecret?.trim() || normalizedSecretKey || "portacall-handoff";
	const webhookSecret = options.webhookSecret?.trim() ?? "";
	const authAdapter = options.auth as
		| PortacallAuthAdapter<AuthContext, RestoredAuth>
		| undefined;
	const sharedOptions = {
		baseURL: options.baseURL,
		fetch: options.fetch,
		headers: options.headers,
		secretKey: normalizedSecretKey,
	} satisfies PortacallOptions & { secretKey: string };

	return {
		agent(agentId: string): PortacallAgent<RestoredAuth> {
			const normalizedAgentId = agentId.trim();
			if (!normalizedAgentId) {
				throw new Error("Agent ID is required.");
			}

			const tools = new Map<string, RegisteredToolInternal<RestoredAuth>>();

			const chat = async (
				message: string,
				externalUserId: string,
				conversationId?: string,
				authHandoff?: string,
			): Promise<ChatResponse> => {
				const response = await requestPortacall(
					sharedOptions,
					normalizedAgentId,
					"/chat",
					{
						body: createChatRequestBody(
							message,
							externalUserId,
							conversationId,
						),
						authHandoff,
					},
				);

				if (!response.ok) {
					throw await createRequestError(response, "Portacall request failed.");
				}

				return (await response.json()) as ChatResponse;
			};

			const createConversation = async (
				externalUserId: string,
				title?: string,
			): Promise<PortacallConversationSummary> => {
				const response = await requestPortacall(
					sharedOptions,
					normalizedAgentId,
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

				const payload =
					(await response.json()) as PortacallConversationResponse;
				return payload.conversation;
			};

			const listConversations = async (input: {
				externalUserId: string;
				limit?: number;
				offset?: number;
				includeArchived?: boolean;
			}): Promise<PortacallConversationListResponse> => {
				const response = await requestPortacall(
					sharedOptions,
					normalizedAgentId,
					"/conversations",
					{
						searchParams: {
							externalUserId: normalizeRequiredExternalUserId(
								input.externalUserId,
							),
							limit: normalizeOptionalLimit(input.limit),
							offset: normalizeOptionalOffset(input.offset),
							includeArchived: input.includeArchived,
						},
					},
				);

				if (!response.ok) {
					throw await createRequestError(response, "Portacall request failed.");
				}

				return (await response.json()) as PortacallConversationListResponse;
			};

			const getConversationMessages = async (
				conversationId: string,
				externalUserId: string,
				options: {
					limit?: number;
					offset?: number;
				} = {},
			): Promise<PortacallConversationMessagesResponse> => {
				const response = await requestPortacall(
					sharedOptions,
					normalizedAgentId,
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

			const getToolRuns = async (
				conversationId: string,
				externalUserId: string,
				options: {
					status?: string;
				} = {},
			): Promise<PortacallToolRunListResponse> => {
				const response = await requestPortacall(
					sharedOptions,
					normalizedAgentId,
					`/conversations/${encodeURIComponent(normalizeConversationId(conversationId))}/tool-runs`,
					{
						searchParams: {
							externalUserId: normalizeRequiredExternalUserId(externalUserId),
							status: options.status,
						},
					},
				);

				if (!response.ok) {
					throw await createRequestError(response, "Portacall request failed.");
				}

				return (await response.json()) as PortacallToolRunListResponse;
			};

			const renameConversation = async (
				conversationId: string,
				externalUserId: string,
				title: string,
			): Promise<PortacallConversationSummary> => {
				const response = await requestPortacall(
					sharedOptions,
					normalizedAgentId,
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

				const payload =
					(await response.json()) as PortacallConversationResponse;
				return payload.conversation;
			};

			const setConversationArchived = async (
				conversationId: string,
				externalUserId: string,
				archived: boolean,
			): Promise<PortacallConversationSummary> => {
				const response = await requestPortacall(
					sharedOptions,
					normalizedAgentId,
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

				const payload =
					(await response.json()) as PortacallConversationResponse;
				return payload.conversation;
			};

			const deleteConversation = async (
				conversationId: string,
				externalUserId: string,
			): Promise<void> => {
				const response = await requestPortacall(
					sharedOptions,
					normalizedAgentId,
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

			const approveToolRun = async (
				toolRunId: string,
				externalUserId: string,
			): Promise<PortacallToolRunResolveResponse> =>
				resolveToolRun(
					sharedOptions,
					normalizedAgentId,
					toolRunId,
					"approve",
					externalUserId,
				);

			const denyToolRun = async (
				toolRunId: string,
				externalUserId: string,
			): Promise<PortacallToolRunResolveResponse> =>
				resolveToolRun(
					sharedOptions,
					normalizedAgentId,
					toolRunId,
					"deny",
					externalUserId,
				);

			const completeToolRun = async (
				toolRunId: string,
				body: PortacallToolRunCompleteBody,
			): Promise<PortacallToolRunCompleteResponse> => {
				const response = await requestPortacall(
					sharedOptions,
					normalizedAgentId,
					`/tool-runs/${encodeURIComponent(normalizeToolRunId(toolRunId))}/complete`,
					{
						body: {
							status: body.status,
							message: body.message,
							errorCode: body.errorCode,
							output: body.output,
						},
					},
				);

				if (!response.ok) {
					throw await createRequestError(response, "Portacall request failed.");
				}

				return (await response.json()) as PortacallToolRunCompleteResponse;
			};

			const openStream = async (
				message: string,
				externalUserId: string,
				conversationId?: string,
				authHandoff?: string,
			): Promise<{
				stream: ReadableStream<Uint8Array>;
				conversationId: string;
				responseHeaders: Record<string, string>;
			}> => {
				const response = await requestPortacall(
					sharedOptions,
					normalizedAgentId,
					"/stream",
					{
						body: createChatRequestBody(
							message,
							externalUserId,
							conversationId,
						),
						headers: {
							accept: "text/event-stream",
						},
						authHandoff,
					},
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
					responseHeaders: createStreamResponseHeaders(response.headers),
				};
			};

			const syncTools = async (): Promise<PortacallToolSyncResponse> => {
				const payload: PortacallToolSyncRequest = {
					tools: Array.from(tools.values()).map((tool) => ({
						id: tool.id,
						name: tool.name,
						description: tool.description,
						requiresConfirmation: tool.requiresConfirmation,
						completionMode: tool.completionMode,
					})),
				};
				const response = await requestPortacall(
					sharedOptions,
					normalizedAgentId,
					"/tools/sync",
					{
						body: payload,
					},
				);

				if (!response.ok) {
					throw await createRequestError(response, "Portacall request failed.");
				}

				return (await response.json()) as PortacallToolSyncResponse;
			};

			return {
				id: normalizedAgentId,
				handler(request: Request): Promise<Response> {
					return handlePortacallRequest(
						{
							configured,
							expectedAgentId: normalizedAgentId,
							captureAuthHandoff: async ({ request, externalUserId }) => {
								if (!authAdapter) {
									return undefined;
								}

								const authContext = await authAdapter.capture({
									agentId: normalizedAgentId,
									externalUserId,
									request,
								});
								if (!authContext) {
									return undefined;
								}

								const serialized = await authAdapter.serialize({
									agentId: normalizedAgentId,
									externalUserId,
									request,
									authContext,
								});

								return createPortacallAuthHandoff({
									adapter: authAdapter.name,
									payload: serialized,
									secret: handoffSecret,
									ttlSeconds:
										options.authHandoffTtlSeconds ??
										DEFAULT_AUTH_HANDOFF_TTL_SECONDS,
								});
							},
							chat,
							approveToolRun,
							completeToolRun,
							createConversation,
							deleteConversation,
							denyToolRun,
							getToolRuns,
							getConversationMessages,
							listConversations,
							openStream,
							renameConversation,
							setConversationArchived,
							syncTools: async () => syncTools(),
						},
						request,
					);
				},
				webhook(request: Request): Promise<Response> {
					return handlePortacallWebhook(request, {
						secret: webhookSecret,
						onTool: async (event) => {
							const registeredTool = tools.get(event.tool.name);
							if (!registeredTool) {
								return {
									status: "failed",
									error: {
										message: `No registered server tool found for ${event.tool.name}.`,
										code: "unknown_tool",
									},
								};
							}

							const authResult = await restoreAuthContext(
								authAdapter,
								handoffSecret,
								registeredTool,
								event,
							);
							if (authResult.response) {
								return authResult.response;
							}

							return registeredTool.execute({
								event,
								payload: readToolPayload(event),
								auth: authResult.auth,
								completeToolRun,
							});
						},
					});
				},
				completeToolRun,
				syncTools,
				registerTool(
					definition: PortacallToolDefinition,
					handler: PortacallToolHandler<RestoredAuth>,
				): PortacallRegisteredTool {
					const normalizedTool = normalizeToolDefinition(
						normalizedAgentId,
						definition,
					);
					tools.set(normalizedTool.name, {
						...normalizedTool,
						execute: handler,
					});
					return normalizedTool;
				},
				getRegisteredTools(): PortacallRegisteredTool[] {
					return Array.from(tools.values()).map((tool) => ({
						id: tool.id,
						name: tool.name,
						description: tool.description,
						requiresConfirmation: tool.requiresConfirmation,
						completionMode: tool.completionMode,
						requiresAuth: tool.requiresAuth,
					}));
				},
			};
		},
	};
}

async function restoreAuthContext<RestoredAuth>(
	authAdapter:
		| PortacallAuthAdapter<Record<string, unknown>, RestoredAuth>
		| undefined,
	handoffSecret: string,
	tool: PortacallRegisteredTool,
	event: PortacallToolWebhookEvent,
): Promise<{
	auth: RestoredAuth | null;
	response?: PortacallToolWebhookResponse;
}> {
	const handoffToken = event.meta.authHandoff?.trim();
	if (!handoffToken) {
		if (tool.requiresAuth) {
			return {
				auth: null,
				response: authAdapter?.onMissingAuth
					? await authAdapter.onMissingAuth({ event, tool })
					: {
							status: "failed",
							error: {
								message: "Missing authenticated user context for this tool.",
								code: "missing_auth_context",
							},
						},
			};
		}

		return { auth: null };
	}

	if (!authAdapter) {
		return {
			auth: null,
			response: {
				status: "failed",
				error: {
					message:
						"Received an auth handoff token but no auth adapter is configured.",
					code: "missing_auth_adapter",
				},
			},
		};
	}

	const decoded = await readPortacallAuthHandoff({
		token: handoffToken,
		secret: handoffSecret,
	});
	if (!decoded.ok) {
		return {
			auth: null,
			response: {
				status: "failed",
				error: {
					message: decoded.message,
					code: decoded.code,
				},
			},
		};
	}

	if (decoded.adapter !== authAdapter.name) {
		return {
			auth: null,
			response: {
				status: "failed",
				error: {
					message: `Auth handoff adapter mismatch. Expected ${authAdapter.name}, received ${decoded.adapter}.`,
					code: "auth_adapter_mismatch",
				},
			},
		};
	}

	const restored = await authAdapter.restore({
		event,
		payload: decoded.payload,
	});
	if (!restored && tool.requiresAuth) {
		return {
			auth: null,
			response: authAdapter.onMissingAuth
				? await authAdapter.onMissingAuth({ event, tool })
				: {
						status: "failed",
						error: {
							message: "The authenticated user context could not be restored.",
							code: "auth_restore_failed",
						},
					},
		};
	}

	return {
		auth: restored,
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
		body?: Record<string, unknown>;
		headers?: Record<string, string>;
		searchParams?: Record<string, boolean | number | string | undefined>;
		authHandoff?: string;
	} = {},
): Promise<Response> {
	const fetchImpl = options.fetch ?? globalThis.fetch;
	const method =
		requestOptions.method ?? (requestOptions.body ? "POST" : "GET");
	const headers: Record<string, string> = {
		...(requestOptions.body
			? { "content-type": "application/json; charset=utf-8" }
			: {}),
		authorization: `Bearer ${options.secretKey}`,
		...requestOptions.headers,
		...options.headers,
	};
	if (requestOptions.authHandoff) {
		headers[AUTH_HANDOFF_HEADER] = requestOptions.authHandoff;
	}

	return fetchImpl(
		createPortacallURL(options, agentId, path, requestOptions.searchParams),
		{
			method,
			headers,
			...(requestOptions.body
				? {
						body: JSON.stringify(stripUndefinedProperties(requestOptions.body)),
					}
				: {}),
		},
	);
}

async function resolveToolRun(
	options: PortacallOptions & { secretKey: string },
	agentId: string,
	toolRunId: string,
	decision: "approve" | "deny",
	externalUserId: string,
): Promise<PortacallToolRunResolveResponse> {
	const response = await requestPortacall(
		options,
		agentId,
		`/tool-runs/${encodeURIComponent(normalizeToolRunId(toolRunId))}/${decision}`,
		{
			body: {
				externalUserId: normalizeRequiredExternalUserId(externalUserId),
			},
		},
	);

	if (!response.ok) {
		throw await createRequestError(response, "Portacall request failed.");
	}

	return (await response.json()) as PortacallToolRunResolveResponse;
}

function normalizeToolDefinition(
	agentId: string,
	definition: PortacallToolDefinition,
): PortacallRegisteredTool {
	const name = normalizeRequiredToolName(definition.name);
	const description = normalizeRequiredToolDescription(definition.description);
	return {
		id:
			definition.id?.trim() || createDeterministicToolId(`${agentId}:${name}`),
		name,
		description,
		requiresConfirmation: definition.requiresConfirmation ?? false,
		completionMode:
			definition.completionMode === "wait_for_result"
				? "wait_for_result"
				: "accept_immediately",
		requiresAuth: definition.requiresAuth ?? false,
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

function readToolPayload(
	event: PortacallToolWebhookEvent,
): Record<string, unknown> {
	return isRecord(event.args.payload) ? event.args.payload : {};
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

function normalizeToolRunId(toolRunId: string | null | undefined): string {
	const value = toolRunId?.trim();
	if (!value) {
		throw new Error("Tool run ID is required.");
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

function normalizeRequiredToolName(name: string | null | undefined): string {
	const value = name?.trim();
	if (!value) {
		throw new Error("Tool name is required.");
	}

	if (value.length > 64) {
		throw new Error("Tool name must be 64 characters or fewer.");
	}

	return value;
}

function normalizeRequiredToolDescription(
	description: string | null | undefined,
): string {
	const value = description?.trim();
	if (!value) {
		throw new Error("Tool description is required.");
	}

	if (value.length > 500) {
		throw new Error("Tool description must be 500 characters or fewer.");
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
	value: Record<string, unknown>,
): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
	) as Record<string, unknown>;
}

function createDeterministicToolId(input: string): string {
	const hash = cyrb128(input);
	const bytes = [
		hash[0] >>> 24,
		(hash[0] >>> 16) & 0xff,
		(hash[0] >>> 8) & 0xff,
		hash[0] & 0xff,
		hash[1] >>> 24,
		(hash[1] >>> 16) & 0xff,
		(hash[1] >>> 8) & 0xff,
		hash[1] & 0xff,
		hash[2] >>> 24,
		(hash[2] >>> 16) & 0xff,
		(hash[2] >>> 8) & 0xff,
		hash[2] & 0xff,
		hash[3] >>> 24,
		(hash[3] >>> 16) & 0xff,
		(hash[3] >>> 8) & 0xff,
		hash[3] & 0xff,
	];
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function cyrb128(value: string): [number, number, number, number] {
	let h1 = 1779033703;
	let h2 = 3144134277;
	let h3 = 1013904242;
	let h4 = 2773480762;
	for (let index = 0; index < value.length; index += 1) {
		const code = value.charCodeAt(index);
		h1 = h2 ^ Math.imul(h1 ^ code, 597399067);
		h2 = h3 ^ Math.imul(h2 ^ code, 2869860233);
		h3 = h4 ^ Math.imul(h3 ^ code, 951274213);
		h4 = h1 ^ Math.imul(h4 ^ code, 2716044179);
	}
	h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
	h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
	h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
	h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
	return [
		(h1 ^ h2 ^ h3 ^ h4) >>> 0,
		(h2 ^ h1) >>> 0,
		(h3 ^ h1) >>> 0,
		(h4 ^ h1) >>> 0,
	];
}
