import type {
	PortacallToolWebhookEvent,
	PortacallToolWebhookResponse,
} from "./webhooks";

export type PortacallFetch = (
	input: RequestInfo | URL,
	init?: RequestInit,
) => Promise<Response>;

export type PortacallOptions = {
	baseURL?: string;
	headers?: Record<string, string>;
	fetch?: PortacallFetch;
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

export type PortacallConversationMessagesResponse = {
	conversation: PortacallConversationSummary;
	messages: PortacallConversationMessage[];
	pagination: PortacallConversationPagination;
};

export type PortacallToolRunStatus =
	| "pending"
	| "approved"
	| "denied"
	| "completed"
	| "failed"
	| "expired";

export type PortacallToolRunDecision = "pending" | "approved" | "denied";

export type PortacallToolRunSummary = {
	id: string;
	conversationId: string;
	agentId: string;
	externalUserId: string;
	toolCallId: string;
	toolName: string;
	summary: string;
	payload: Record<string, unknown>;
	payloadJson: string;
	status: PortacallToolRunStatus;
	decision: PortacallToolRunDecision;
	message: string | null;
	errorCode: string | null;
	output: unknown | null;
	createdAt: string;
	updatedAt: string;
	resolvedAt: string | null;
};

export type PortacallToolRunListResponse = {
	toolRuns: PortacallToolRunSummary[];
};

export type PortacallToolRunResolveResponse = {
	toolRun: PortacallToolRunSummary;
	event: {
		type: "approval_resolved";
		decision: "approved" | "denied";
		toolRun: PortacallToolRunSummary;
	};
	conversation: PortacallConversationSummary;
	assistantMessage?: PortacallConversationMessage;
};

export type PortacallToolRunCompleteBody = {
	status: "completed" | "failed";
	message?: string;
	errorCode?: string;
	output?: unknown;
};

export type PortacallToolRunCompleteResponse = {
	toolRun: PortacallToolRunSummary;
	event: {
		type: "tool_completed";
		toolRun: PortacallToolRunSummary;
	};
	conversation: PortacallConversationSummary;
	assistantMessage?: PortacallConversationMessage;
};

export type PortacallToolDefinition = {
	id?: string;
	name: string;
	description: string;
	requiresConfirmation?: boolean;
	completionMode?: "accept_immediately" | "wait_for_result";
	requiresAuth?: boolean;
};

export type PortacallRegisteredTool = {
	id: string;
	name: string;
	description: string;
	requiresConfirmation: boolean;
	completionMode: "accept_immediately" | "wait_for_result";
	requiresAuth: boolean;
};

export type PortacallToolSyncRequest = {
	tools: Array<{
		id: string;
		name: string;
		description: string;
		requiresConfirmation: boolean;
		completionMode: "accept_immediately" | "wait_for_result";
	}>;
};

export type PortacallToolSyncResponse = {
	tools: PortacallToolSyncRequest["tools"];
};

export type PortacallToolExecutionContext<RestoredAuth = unknown> = {
	event: PortacallToolWebhookEvent;
	payload: Record<string, unknown>;
	auth: RestoredAuth | null;
	completeToolRun: (
		toolRunId: string,
		body: PortacallToolRunCompleteBody,
	) => Promise<PortacallToolRunCompleteResponse>;
};

export type PortacallToolHandler<RestoredAuth = unknown> = (
	context: PortacallToolExecutionContext<RestoredAuth>,
) => PortacallToolWebhookResponse | Promise<PortacallToolWebhookResponse>;

export type PortacallAuthCaptureContext = {
	agentId: string;
	externalUserId: string;
	request: Request;
};

export type PortacallAuthSerializeContext<
	AuthContext extends Record<string, unknown>,
> = {
	agentId: string;
	externalUserId: string;
	request: Request;
	authContext: AuthContext;
};

export type PortacallAuthRestoreContext = {
	event: PortacallToolWebhookEvent;
	payload: Record<string, unknown>;
};

export type PortacallAuthMissingContext = {
	event: PortacallToolWebhookEvent;
	tool: PortacallRegisteredTool;
};

export type PortacallAuthAdapter<
	AuthContext extends Record<string, unknown> = Record<string, unknown>,
	RestoredAuth = unknown,
> = {
	name: string;
	capture(
		context: PortacallAuthCaptureContext,
	): AuthContext | null | Promise<AuthContext | null>;
	serialize(
		context: PortacallAuthSerializeContext<AuthContext>,
	): Record<string, unknown> | Promise<Record<string, unknown>>;
	restore(
		context: PortacallAuthRestoreContext,
	): RestoredAuth | null | Promise<RestoredAuth | null>;
	onMissingAuth?:
		| ((
				context: PortacallAuthMissingContext,
		  ) => PortacallToolWebhookResponse | Promise<PortacallToolWebhookResponse>)
		| undefined;
};

export type PortacallServerOptions<
	AuthContext extends Record<string, unknown> = Record<string, unknown>,
	RestoredAuth = unknown,
> = PortacallOptions & {
	secretKey: string;
	webhookSecret?: string;
	handoffSecret?: string;
	auth?: PortacallAuthAdapter<AuthContext, RestoredAuth>;
	authHandoffTtlSeconds?: number;
};

export type PortacallAgent<RestoredAuth = unknown> = {
	readonly id: string;
	handler(request: Request): Promise<Response>;
	webhook(request: Request): Promise<Response>;
	completeToolRun(
		toolRunId: string,
		body: PortacallToolRunCompleteBody,
	): Promise<PortacallToolRunCompleteResponse>;
	syncTools(): Promise<PortacallToolSyncResponse>;
	registerTool(
		definition: PortacallToolDefinition,
		handler: PortacallToolHandler<RestoredAuth>,
	): PortacallRegisteredTool;
	getRegisteredTools(): PortacallRegisteredTool[];
};

export type PortacallServer<RestoredAuth = unknown> = {
	agent(agentId: string): PortacallAgent<RestoredAuth>;
};
