import type { Hono } from "hono";

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
	handler(request: Request): Promise<Response>;
	hono(): Hono;
	express(): PortacallExpressHandler;
};

export type PortacallExpressHandler = (
	request: unknown,
	response: unknown,
	next?: (error?: unknown) => void,
) => Promise<void>;
