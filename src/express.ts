import type { PortacallExpressHandler } from "./types";

type ExpressRequestLike = {
	body?: unknown;
	headers?: Record<string, string | string[] | undefined>;
	method?: string;
	originalUrl?: string;
	protocol?: string;
	socket?: {
		encrypted?: boolean;
	};
	url?: string;
};

type ExpressResponseLike = {
	end(chunk?: string | Uint8Array): unknown;
	setHeader(name: string, value: string | readonly string[]): unknown;
	status(code: number): ExpressResponseLike;
	write(chunk: string | Uint8Array): unknown;
};

type PortacallRequestHandler = {
	handler(request: Request): Promise<Response>;
};

export function createPortacallExpress(
	agent: PortacallRequestHandler,
): PortacallExpressHandler {
	return async (request, response, next) => {
		try {
			const expressRequest = request as ExpressRequestLike;
			const expressResponse = response as ExpressResponseLike;
			const webRequest = createWebRequest(expressRequest);
			const webResponse = await agent.handler(webRequest);

			expressResponse.status(webResponse.status);
			webResponse.headers.forEach((value, name) => {
				expressResponse.setHeader(name, value);
			});

			if (!webResponse.body) {
				expressResponse.end();
				return;
			}

			const reader = webResponse.body.getReader();
			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) {
						expressResponse.end();
						return;
					}

					expressResponse.write(value);
				}
			} finally {
				reader.releaseLock();
			}
		} catch (error) {
			if (typeof next === "function") {
				next(error);
				return;
			}

			throw error;
		}
	};
}

function createWebRequest(request: ExpressRequestLike): Request {
	const body = createRequestBody(request);

	return new Request(createURL(request), {
		method: request.method ?? "GET",
		headers: createHeaders(request.headers),
		body,
		...(body ? { duplex: "half" as const } : {}),
	});
}

function createURL(request: ExpressRequestLike): string {
	const protocol =
		request.protocol ?? (request.socket?.encrypted ? "https" : "http");
	const host = firstHeaderValue(request.headers?.host) ?? "localhost";
	const path = request.originalUrl ?? request.url ?? "/";
	return new URL(path, `${protocol}://${host}`).toString();
}

function createHeaders(
	headers: ExpressRequestLike["headers"],
): HeadersInit | undefined {
	if (!headers) {
		return undefined;
	}

	const normalized = new Headers();
	for (const [key, value] of Object.entries(headers)) {
		if (Array.isArray(value)) {
			for (const item of value) {
				normalized.append(key, item);
			}
			continue;
		}

		if (value !== undefined) {
			normalized.set(key, value);
		}
	}

	return normalized;
}

function createRequestBody(
	request: ExpressRequestLike,
): RequestInit["body"] | undefined {
	if (request.body === undefined || request.body === null) {
		return hasBodyMethod(request.method)
			? (request as unknown as RequestInit["body"])
			: undefined;
	}

	if (
		typeof request.body === "string" ||
		request.body instanceof Blob ||
		request.body instanceof ArrayBuffer ||
		request.body instanceof FormData ||
		request.body instanceof URLSearchParams
	) {
		return request.body;
	}

	if (request.body instanceof Uint8Array) {
		return request.body as unknown as BodyInit;
	}

	return JSON.stringify(request.body);
}

function hasBodyMethod(method: string | undefined): boolean {
	return method === "POST" || method === "PUT" || method === "PATCH";
}

function firstHeaderValue(
	value: string | string[] | undefined,
): string | undefined {
	return Array.isArray(value) ? value[0] : value;
}
