import { PortacallError } from "./errors";
import {
	createRequestError,
	normalizeMessage,
	readServerSentEvents,
} from "./shared";

const DEFAULT_BACKEND_URL = "";

type ChatResponse = {
	content: string;
	conversationId: string;
	events: PortacallChatEvent[];
};

type PortacallConversationResponse = {
	conversation: PortacallConversationSummary;
};

export type PortacallConversationSummary = {
	id: string;
	title: string | null;
	createdAt: string;
	updatedAt: string;
	lastMessageAt: string;
	archivedAt: string | null;
};

export type PortacallConversationPagination = {
	limit: number;
	offset: number;
	hasMore: boolean;
};

export type PortacallConversationListOptions = {
	limit?: number;
	offset?: number;
	includeArchived?: boolean;
};

export type PortacallConversationListResponse = {
	conversations: PortacallConversationSummary[];
	pagination: PortacallConversationPagination;
};

export type PortacallConversationMessage = {
	id: string;
	role: "user" | "assistant";
	content: string;
	createdAt: string;
};

export type PortacallActionRunStatus =
	| "pending"
	| "approved"
	| "denied"
	| "completed"
	| "failed"
	| "expired";

export type PortacallActionRunDecision = "pending" | "approved" | "denied";

export type PortacallActionRunSummary = {
	id: string;
	conversationId: string;
	agentId: string;
	externalUserId: string;
	toolCallId: string;
	actionName: string;
	summary: string;
	payload: Record<string, unknown>;
	payloadJson: string;
	status: PortacallActionRunStatus;
	decision: PortacallActionRunDecision;
	message: string | null;
	errorCode: string | null;
	output: unknown | null;
	createdAt: string;
	updatedAt: string;
	resolvedAt: string | null;
};

export type PortacallActionRunListOptions = {
	status?: PortacallActionRunStatus;
};

export type PortacallActionRunListResponse = {
	actionRuns: PortacallActionRunSummary[];
};

export type PortacallActionRunResolveResponse = {
	actionRun: PortacallActionRunSummary;
	event: PortacallStreamApprovalResolvedEvent;
	conversation: PortacallConversationSummary;
	assistantMessage?: PortacallConversationMessage;
};

export type PortacallConversationMessagesOptions = {
	limit?: number;
	offset?: number;
};

export type PortacallConversationMessagesResponse = {
	conversation: PortacallConversationSummary;
	messages: PortacallConversationMessage[];
	pagination: PortacallConversationPagination;
};

export type PortacallChatOptions = {
	externalUserId: string;
	conversationId?: string | null;
};

export type PortacallChatEvent = Exclude<
	PortacallStreamEvent,
	PortacallStreamErrorEvent
>;

export type PortacallChatResult = {
	content: string;
	conversationId: string;
	events: PortacallChatEvent[];
};

export type PortacallStreamOptions = {
	externalUserId: string;
	conversationId?: string | null;
};

export type PortacallStreamConversationIdEvent = {
	type: "conversation_id";
	conversationId: string;
};

export type PortacallStreamTextDeltaEvent = {
	type: "text_delta";
	text: string;
};

export type PortacallStreamToolCallStartedEvent = {
	type: "tool_call_started";
	toolCallId: string;
	toolName: string;
	args: Record<string, unknown>;
};

export type PortacallStreamToolCallCompletedEvent = {
	type: "tool_call_completed";
	toolCallId: string;
	toolName: string;
	args: Record<string, unknown>;
	status: "accepted" | "completed";
	message?: string;
	output?: unknown;
};

export type PortacallStreamToolCallFailedEvent = {
	type: "tool_call_failed";
	toolCallId: string;
	toolName: string;
	args: Record<string, unknown>;
	message: string;
	code?: string;
};

export type PortacallStreamApprovalRequestedEvent = {
	type: "approval_requested";
	actionRun: PortacallActionRunSummary;
};

export type PortacallStreamApprovalResolvedEvent = {
	type: "approval_resolved";
	decision: "approved" | "denied";
	actionRun: PortacallActionRunSummary;
};

export type PortacallStreamMessageCompletedEvent = {
	type: "message_completed";
	conversationId: string;
};

export type PortacallStreamErrorEvent = {
	type: "error";
	message: string;
	code?: string;
};

export type PortacallStreamEvent =
	| PortacallStreamConversationIdEvent
	| PortacallStreamTextDeltaEvent
	| PortacallStreamToolCallStartedEvent
	| PortacallStreamToolCallCompletedEvent
	| PortacallStreamToolCallFailedEvent
	| PortacallStreamApprovalRequestedEvent
	| PortacallStreamApprovalResolvedEvent
	| PortacallStreamMessageCompletedEvent
	| PortacallStreamErrorEvent;

export type PortacallConversationCreateOptions = {
	title?: string | null;
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
	createConversation(
		externalUserId: string,
		options?: PortacallConversationCreateOptions,
	): Promise<PortacallConversationSummary>;
	getConversations(
		externalUserId: string,
		options?: PortacallConversationListOptions,
	): Promise<PortacallConversationListResponse>;
	getConversationMessages(
		conversationId: string,
		externalUserId: string,
		options?: PortacallConversationMessagesOptions,
	): Promise<PortacallConversationMessagesResponse>;
	getActionRuns(
		conversationId: string,
		externalUserId: string,
		options?: PortacallActionRunListOptions,
	): Promise<PortacallActionRunListResponse>;
	approveActionRun(
		actionRunId: string,
		externalUserId: string,
	): Promise<PortacallActionRunResolveResponse>;
	denyActionRun(
		actionRunId: string,
		externalUserId: string,
	): Promise<PortacallActionRunResolveResponse>;
	renameConversation(
		conversationId: string,
		externalUserId: string,
		title: string,
	): Promise<PortacallConversationSummary>;
	archiveConversation(
		conversationId: string,
		externalUserId: string,
	): Promise<PortacallConversationSummary>;
	unarchiveConversation(
		conversationId: string,
		externalUserId: string,
	): Promise<PortacallConversationSummary>;
	deleteConversation(
		conversationId: string,
		externalUserId: string,
	): Promise<void>;
	chat(
		message: string,
		options: PortacallChatOptions,
	): Promise<PortacallChatResult>;
	stream(
		message: string,
		options: PortacallStreamOptions,
	): AsyncIterable<PortacallStreamEvent>;
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
		async createConversation(
			externalUserId: string,
			createOptions: PortacallConversationCreateOptions = {},
		): Promise<PortacallConversationSummary> {
			const response = await request(baseURL, options, "/conversations", {
				body: {
					externalUserId: normalizeRequiredExternalUserId(externalUserId),
					...createOptionalTitleBody(createOptions.title),
				},
			});

			if (!response.ok) {
				throw await createRequestError(response, "Portacall request failed.");
			}

			const payload = (await response.json()) as PortacallConversationResponse;
			currentConversationId = payload.conversation.id;
			return payload.conversation;
		},
		async getConversations(
			externalUserId: string,
			listOptions: PortacallConversationListOptions = {},
		): Promise<PortacallConversationListResponse> {
			const response = await request(baseURL, options, "/conversations", {
				searchParams: createConversationListSearchParams(
					externalUserId,
					listOptions,
				),
			});

			if (!response.ok) {
				throw await createRequestError(response, "Portacall request failed.");
			}

			return (await response.json()) as PortacallConversationListResponse;
		},
		async getConversationMessages(
			conversationId: string,
			externalUserId: string,
			messageOptions: PortacallConversationMessagesOptions = {},
		): Promise<PortacallConversationMessagesResponse> {
			const normalizedConversationId = normalizeConversationId(conversationId);
			const response = await request(
				baseURL,
				options,
				`/conversations/${encodeURIComponent(normalizedConversationId)}/messages`,
				{
					searchParams: createConversationMessagesSearchParams(
						externalUserId,
						messageOptions,
					),
				},
			);

			if (!response.ok) {
				throw await createRequestError(response, "Portacall request failed.");
			}

			const payload =
				(await response.json()) as PortacallConversationMessagesResponse;
			currentConversationId = payload.conversation.id;
			return payload;
		},
		async getActionRuns(
			conversationId: string,
			externalUserId: string,
			actionRunOptions: PortacallActionRunListOptions = {},
		): Promise<PortacallActionRunListResponse> {
			const normalizedConversationId = normalizeConversationId(conversationId);
			const response = await request(
				baseURL,
				options,
				`/conversations/${encodeURIComponent(normalizedConversationId)}/action-runs`,
				{
					searchParams: {
						externalUserId: normalizeRequiredExternalUserId(externalUserId),
						status: actionRunOptions.status,
					},
				},
			);

			if (!response.ok) {
				throw await createRequestError(response, "Portacall request failed.");
			}

			return (await response.json()) as PortacallActionRunListResponse;
		},
		async approveActionRun(
			actionRunId: string,
			externalUserId: string,
		): Promise<PortacallActionRunResolveResponse> {
			const payload = await resolveActionRun(
				baseURL,
				options,
				actionRunId,
				"approve",
				externalUserId,
			);
			currentConversationId = payload.conversation.id;
			return payload;
		},
		async denyActionRun(
			actionRunId: string,
			externalUserId: string,
		): Promise<PortacallActionRunResolveResponse> {
			const payload = await resolveActionRun(
				baseURL,
				options,
				actionRunId,
				"deny",
				externalUserId,
			);
			currentConversationId = payload.conversation.id;
			return payload;
		},
		async renameConversation(
			conversationId: string,
			externalUserId: string,
			title: string,
		): Promise<PortacallConversationSummary> {
			return updateConversation(
				baseURL,
				options,
				normalizeConversationId(conversationId),
				{
					externalUserId: normalizeRequiredExternalUserId(externalUserId),
					title: normalizeRequiredTitle(title),
				},
			);
		},
		async archiveConversation(
			conversationId: string,
			externalUserId: string,
		): Promise<PortacallConversationSummary> {
			return updateConversationArchiveState(
				baseURL,
				options,
				normalizeConversationId(conversationId),
				externalUserId,
				true,
			);
		},
		async unarchiveConversation(
			conversationId: string,
			externalUserId: string,
		): Promise<PortacallConversationSummary> {
			return updateConversationArchiveState(
				baseURL,
				options,
				normalizeConversationId(conversationId),
				externalUserId,
				false,
			);
		},
		async deleteConversation(
			conversationId: string,
			externalUserId: string,
		): Promise<void> {
			const normalizedConversationId = normalizeConversationId(conversationId);
			const response = await request(
				baseURL,
				options,
				`/conversations/${encodeURIComponent(normalizedConversationId)}`,
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

			if (currentConversationId === normalizedConversationId) {
				currentConversationId = null;
			}
		},
		async chat(
			message: string,
			chatOptions: PortacallChatOptions,
		): Promise<PortacallChatResult> {
			const response = await request(baseURL, options, "/chat", {
				body: createChatBody(
					message,
					chatOptions.externalUserId,
					resolveConversationId(
						chatOptions.conversationId,
						currentConversationId,
					),
				),
			});

			if (!response.ok) {
				throw await createRequestError(response, "Portacall request failed.");
			}

			const payload = (await response.json()) as ChatResponse;
			currentConversationId = payload.conversationId;
			return payload;
		},
		async *stream(
			message: string,
			streamOptions: PortacallStreamOptions,
		): AsyncIterable<PortacallStreamEvent> {
			const response = await request(baseURL, options, "/stream", {
				body: createChatBody(
					message,
					streamOptions.externalUserId,
					resolveConversationId(
						streamOptions.conversationId,
						currentConversationId,
					),
				),
				headers: {
					accept: "text/event-stream",
				},
			});

			if (!response.ok) {
				throw await createRequestError(response, "Portacall request failed.");
			}

			if (!response.body) {
				throw new PortacallError("Portacall stream body is empty.", {
					status: 500,
				});
			}

			const contentType = response.headers.get("content-type")?.trim() ?? "";
			if (!contentType.toLowerCase().startsWith("text/event-stream")) {
				throw new PortacallError(
					"Portacall stream response must use text/event-stream.",
					{ status: 500 },
				);
			}

			for await (const rawEvent of readServerSentEvents(response.body)) {
				const event = parseStreamEvent(rawEvent.data);
				if (event.type === "conversation_id") {
					currentConversationId = event.conversationId;
				}
				yield event;
			}
		},
	};
}

async function updateConversation(
	baseURL: string,
	options: PortacallClientOptions,
	conversationId: string,
	body: {
		externalUserId: string;
		title: string;
	},
): Promise<PortacallConversationSummary> {
	const response = await request(
		baseURL,
		options,
		`/conversations/${encodeURIComponent(conversationId)}`,
		{
			method: "PATCH",
			body,
		},
	);

	if (!response.ok) {
		throw await createRequestError(response, "Portacall request failed.");
	}

	const payload = (await response.json()) as PortacallConversationResponse;
	return payload.conversation;
}

async function updateConversationArchiveState(
	baseURL: string,
	options: PortacallClientOptions,
	conversationId: string,
	externalUserId: string,
	archived: boolean,
): Promise<PortacallConversationSummary> {
	const response = await request(
		baseURL,
		options,
		`/conversations/${encodeURIComponent(conversationId)}/archive`,
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
}

async function resolveActionRun(
	baseURL: string,
	options: PortacallClientOptions,
	actionRunId: string,
	decision: "approve" | "deny",
	externalUserId: string,
): Promise<PortacallActionRunResolveResponse> {
	const normalizedActionRunId = normalizeActionRunId(actionRunId);
	const response = await request(
		baseURL,
		options,
		`/action-runs/${encodeURIComponent(normalizedActionRunId)}/${decision}`,
		{
			body: {
				externalUserId: normalizeRequiredExternalUserId(externalUserId),
			},
		},
	);

	if (!response.ok) {
		throw await createRequestError(response, "Portacall request failed.");
	}

	return (await response.json()) as PortacallActionRunResolveResponse;
}

async function request(
	baseURL: string,
	options: PortacallClientOptions,
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

	return fetchImpl(createURL(baseURL, path, requestOptions.searchParams), {
		method,
		headers: {
			...(requestOptions.body
				? { "content-type": "application/json; charset=utf-8" }
				: {}),
			...requestOptions.headers,
			...options.headers,
		},
		...(requestOptions.body
			? { body: JSON.stringify(stripUndefinedProperties(requestOptions.body)) }
			: {}),
	});
}

function parseStreamEvent(data: string): PortacallStreamEvent {
	let parsed: unknown;

	try {
		parsed = JSON.parse(data) as unknown;
	} catch {
		throw new PortacallError(
			"Portacall stream event payload is invalid JSON.",
			{
				status: 500,
			},
		);
	}

	if (!isRecord(parsed) || typeof parsed.type !== "string") {
		throw new PortacallError("Portacall stream event payload is invalid.", {
			status: 500,
		});
	}

	switch (parsed.type) {
		case "conversation_id":
			if (typeof parsed.conversationId === "string" && parsed.conversationId) {
				return parsed as PortacallStreamConversationIdEvent;
			}
			break;
		case "text_delta":
			if (typeof parsed.text === "string") {
				return parsed as PortacallStreamTextDeltaEvent;
			}
			break;
		case "tool_call_started":
			if (isToolCallEventBase(parsed)) {
				return parsed as PortacallStreamToolCallStartedEvent;
			}
			break;
		case "tool_call_completed":
			if (isToolCallCompletedEventData(parsed)) {
				return parsed as PortacallStreamToolCallCompletedEvent;
			}
			break;
		case "tool_call_failed":
			if (isToolCallFailedEventData(parsed)) {
				return parsed as PortacallStreamToolCallFailedEvent;
			}
			break;
		case "approval_requested":
			if (isApprovalRequestedEventData(parsed)) {
				return parsed as PortacallStreamApprovalRequestedEvent;
			}
			break;
		case "approval_resolved":
			if (isApprovalResolvedEventData(parsed)) {
				return parsed as PortacallStreamApprovalResolvedEvent;
			}
			break;
		case "message_completed":
			if (typeof parsed.conversationId === "string" && parsed.conversationId) {
				return parsed as PortacallStreamMessageCompletedEvent;
			}
			break;
		case "error":
			if (typeof parsed.message === "string") {
				return parsed as PortacallStreamErrorEvent;
			}
			break;
	}

	throw new PortacallError("Portacall stream event payload is invalid.", {
		status: 500,
	});
}

function isToolCallEventBase(value: Record<string, unknown>): value is {
	toolCallId: string;
	toolName: string;
	args: Record<string, unknown>;
} {
	return (
		typeof value.toolCallId === "string" &&
		value.toolCallId.length > 0 &&
		typeof value.toolName === "string" &&
		value.toolName.length > 0 &&
		isRecord(value.args)
	);
}

function isToolCallCompletedEventData(
	value: Record<string, unknown>,
): value is {
	toolCallId: string;
	toolName: string;
	args: Record<string, unknown>;
	status: "accepted" | "completed";
} {
	const candidate = value as Record<string, unknown>;
	return (
		isToolCallEventBase(value) &&
		(candidate.status === "accepted" || candidate.status === "completed")
	);
}

function isToolCallFailedEventData(value: Record<string, unknown>): value is {
	toolCallId: string;
	toolName: string;
	args: Record<string, unknown>;
	message: string;
} {
	const candidate = value as Record<string, unknown>;
	return isToolCallEventBase(value) && typeof candidate.message === "string";
}

function isApprovalRequestedEventData(
	value: Record<string, unknown>,
): value is {
	actionRun: PortacallActionRunSummary;
} {
	return isActionRunSummary(value.actionRun);
}

function isApprovalResolvedEventData(value: Record<string, unknown>): value is {
	decision: "approved" | "denied";
	actionRun: PortacallActionRunSummary;
} {
	return (
		(value.decision === "approved" || value.decision === "denied") &&
		isActionRunSummary(value.actionRun)
	);
}

function isActionRunSummary(
	value: unknown,
): value is PortacallActionRunSummary {
	if (!isRecord(value)) {
		return false;
	}

	return (
		typeof value.id === "string" &&
		value.id.length > 0 &&
		typeof value.conversationId === "string" &&
		value.conversationId.length > 0 &&
		typeof value.agentId === "string" &&
		value.agentId.length > 0 &&
		typeof value.externalUserId === "string" &&
		value.externalUserId.length > 0 &&
		typeof value.toolCallId === "string" &&
		value.toolCallId.length > 0 &&
		typeof value.actionName === "string" &&
		value.actionName.length > 0 &&
		typeof value.summary === "string" &&
		isRecord(value.payload) &&
		typeof value.payloadJson === "string" &&
		isActionRunStatus(value.status) &&
		isActionRunDecision(value.decision) &&
		(value.message === null || typeof value.message === "string") &&
		(value.errorCode === null || typeof value.errorCode === "string") &&
		(value.output === null || value.output !== undefined) &&
		typeof value.createdAt === "string" &&
		typeof value.updatedAt === "string" &&
		(value.resolvedAt === null || typeof value.resolvedAt === "string")
	);
}

function isActionRunStatus(value: unknown): value is PortacallActionRunStatus {
	return (
		value === "pending" ||
		value === "approved" ||
		value === "denied" ||
		value === "completed" ||
		value === "failed" ||
		value === "expired"
	);
}

function isActionRunDecision(
	value: unknown,
): value is PortacallActionRunDecision {
	return value === "pending" || value === "approved" || value === "denied";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function normalizeConversationId(
	conversationId: string | null | undefined,
): string {
	const value = conversationId?.trim();
	if (!value) {
		throw new Error("Conversation ID is required.");
	}

	return value;
}

function normalizeActionRunId(actionRunId: string | null | undefined): string {
	const value = actionRunId?.trim();
	if (!value) {
		throw new Error("Action run ID is required.");
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

function createChatBody(
	message: string,
	externalUserId: string,
	conversationId: string | undefined,
): {
	message: string;
	externalUserId: string;
	conversationId?: string;
} {
	return {
		message: normalizeMessage(message),
		externalUserId: normalizeRequiredExternalUserId(externalUserId),
		...(conversationId ? { conversationId } : {}),
	};
}

function createConversationListSearchParams(
	externalUserId: string,
	options: PortacallConversationListOptions,
): Record<string, boolean | number | string | undefined> {
	return {
		externalUserId: normalizeRequiredExternalUserId(externalUserId),
		limit: normalizeOptionalLimit(options.limit),
		offset: normalizeOptionalOffset(options.offset),
		includeArchived: options.includeArchived,
	};
}

function createConversationMessagesSearchParams(
	externalUserId: string,
	options: PortacallConversationMessagesOptions,
): Record<string, boolean | number | string | undefined> {
	return {
		externalUserId: normalizeRequiredExternalUserId(externalUserId),
		limit: normalizeOptionalLimit(options.limit),
		offset: normalizeOptionalOffset(options.offset),
	};
}

function createOptionalTitleBody(title: string | null | undefined): {
	title?: string;
} {
	if (title == null) {
		return {};
	}

	return {
		title: normalizeRequiredTitle(title),
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

function createURL(
	baseURL: string,
	path: string,
	searchParams?: Record<string, boolean | number | string | undefined>,
): string {
	const serializedSearchParams = serializeSearchParams(searchParams);

	if (/^https?:\/\//.test(baseURL)) {
		const url = new URL(stripLeadingSlash(path), `${baseURL}/`);
		for (const [key, value] of serializedSearchParams.entries()) {
			url.searchParams.set(key, value);
		}

		return url.toString();
	}

	const resolvedPath = `${stripTrailingSlash(baseURL)}${path}`;
	const queryString = serializedSearchParams.toString();
	if (!queryString) {
		return resolvedPath;
	}

	return `${resolvedPath}?${queryString}`;
}

function serializeSearchParams(
	searchParams?: Record<string, boolean | number | string | undefined>,
): URLSearchParams {
	const serialized = new URLSearchParams();

	for (const [key, value] of Object.entries(searchParams ?? {})) {
		if (value === undefined) {
			continue;
		}

		serialized.set(key, String(value));
	}

	return serialized;
}

function stripUndefinedProperties<T extends Record<string, unknown>>(
	value: T,
): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
	);
}

function stripLeadingSlash(value: string): string {
	return value.startsWith("/") ? value.slice(1) : value;
}

function stripTrailingSlash(value: string): string {
	return value.endsWith("/") ? value.slice(0, -1) : value;
}
