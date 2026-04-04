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
	createdAt: string;
	updatedAt: string;
	resolvedAt: string | null;
};

export type PortacallActionRunListResponse = {
	actionRuns: PortacallActionRunSummary[];
};

export type PortacallActionRunResolveResponse = {
	actionRun: PortacallActionRunSummary;
	event: {
		type: "approval_resolved";
		decision: "approved" | "denied";
		actionRun: PortacallActionRunSummary;
	};
	conversation: PortacallConversationSummary;
	assistantMessage?: PortacallConversationMessage;
};

export type Portacall = {
	handler(request: Request): Promise<Response>;
};
