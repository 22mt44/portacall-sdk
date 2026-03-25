import { PortacallError } from "./errors";
import { createRequestError, normalizeMessage, readTextStream } from "./shared";

const DEFAULT_BASE_URL = "/api/agent";

type ChatResponse = {
	content: string;
};

export type { PortacallErrorPayload } from "./errors";
export { PortacallError } from "./errors";

export type PortacallClientFetch = (
	input: RequestInfo | URL,
	init?: RequestInit,
) => Promise<Response>;

export type PortacallClientOptions = {
	baseURL?: string;
	headers?: Record<string, string>;
	fetch?: PortacallClientFetch;
};

export type PortacallClientHealth = {
	ok: boolean;
	configured: boolean;
};

export type PortacallClient = {
	baseURL: string;
	health(): Promise<PortacallClientHealth>;
	chat(message: string): Promise<string>;
	stream(message: string): AsyncIterable<string>;
};

export function portacall(
	options: PortacallClientOptions = {},
): PortacallClient {
	const baseURL = normalizeBaseURL(options.baseURL);

	return {
		baseURL,
		async health(): Promise<PortacallClientHealth> {
			const response = await request(baseURL, options, "/health");

			if (!response.ok) {
				throw await createRequestError(response, "Portacall request failed.");
			}

			return (await response.json()) as PortacallClientHealth;
		},
		async chat(message: string): Promise<string> {
			const response = await request(baseURL, options, "/chat", {
				message: normalizeMessage(message),
			});

			if (!response.ok) {
				throw await createRequestError(response, "Portacall request failed.");
			}

			const payload = (await response.json()) as ChatResponse;
			return payload.content;
		},
		async *stream(message: string): AsyncIterable<string> {
			const response = await request(baseURL, options, "/stream", {
				message: normalizeMessage(message),
			});

			if (!response.ok) {
				throw await createRequestError(response, "Portacall request failed.");
			}

			if (!response.body) {
				throw new PortacallError("Portacall stream body is empty.", {
					status: 500,
				});
			}

			yield* readTextStream(response.body);
		},
	};
}

async function request(
	baseURL: string,
	options: PortacallClientOptions,
	path: string,
	body?: { message: string },
): Promise<Response> {
	const fetchImpl = options.fetch ?? globalThis.fetch;
	return fetchImpl(createURL(baseURL, path), {
		method: body ? "POST" : "GET",
		headers: {
			...(body ? { "content-type": "application/json; charset=utf-8" } : {}),
			...options.headers,
		},
		...(body ? { body: JSON.stringify(body) } : {}),
	});
}

function normalizeBaseURL(baseURL: string | undefined): string {
	const value = baseURL?.trim() ?? "";
	if (!value) {
		return DEFAULT_BASE_URL;
	}

	return value.endsWith("/") ? value.slice(0, -1) : value;
}

function createURL(baseURL: string, path: string): string {
	if (/^https?:\/\//.test(baseURL)) {
		return new URL(stripLeadingSlash(path), `${baseURL}/`).toString();
	}

	return `${stripTrailingSlash(baseURL)}${path}`;
}

function stripLeadingSlash(value: string): string {
	return value.startsWith("/") ? value.slice(1) : value;
}

function stripTrailingSlash(value: string): string {
	return value.endsWith("/") ? value.slice(0, -1) : value;
}
