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

export type Portacall = {
	handler(request: Request): Promise<Response>;
};
