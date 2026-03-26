export type PortacallFetch = (
	input: RequestInfo | URL,
	init?: RequestInit,
) => Promise<Response>;

export type PortacallOptions = {
	agentId: string;
	secretKey: string;
	baseURL?: string;
	headers?: Record<string, string>;
	fetch?: PortacallFetch;
};

export type Portacall = {
	agentId: string;
	handler(request: Request): Promise<Response>;
};
