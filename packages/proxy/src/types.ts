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
	createdAt: string;
	updatedAt: string;
	lastMessageAt: string;
};

export type PortacallConversationListResponse = {
	conversations: PortacallConversationSummary[];
};

export type Portacall = {
	handler(request: Request): Promise<Response>;
};
