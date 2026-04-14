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

export type Portacall = {
	handler(request: Request): Promise<Response>;
	completeToolRun(
		agentId: string,
		toolRunId: string,
		body: PortacallToolRunCompleteBody,
	): Promise<PortacallToolRunCompleteResponse>;
};
