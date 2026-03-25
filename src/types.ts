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
	chat(message: string): Promise<string>;
	stream(message: string): AsyncIterable<string>;
};
