type PortacallHandlerAgent = {
	configured: boolean;
	chat(message: string): Promise<string>;
	openStream(message: string): Promise<ReadableStream<Uint8Array>>;
};

const STREAM_HEADERS = {
	"cache-control": "no-cache, no-transform",
	"content-type": "text/plain; charset=utf-8",
	"x-content-type-options": "nosniff",
};

export async function handlePortacallRequest(
	agent: PortacallHandlerAgent,
	request: Request,
): Promise<Response> {
	const url = new URL(request.url);
	const pathname = trimTrailingSlash(url.pathname);

	if (pathname.endsWith("/health")) {
		return request.method === "GET"
			? json({ ok: true, configured: agent.configured })
			: methodNotAllowed("GET");
	}

	if (pathname.endsWith("/chat")) {
		if (request.method !== "POST") {
			return methodNotAllowed("POST");
		}

		if (!agent.configured) {
			return missingConfiguration();
		}

		const message = await readMessage(request);
		if (!message) {
			return json({ message: "Message is required." }, 400);
		}

		try {
			const content = await agent.chat(message);
			return json({ content });
		} catch (error) {
			return errorResponse(error);
		}
	}

	if (pathname.endsWith("/stream")) {
		if (request.method !== "POST") {
			return methodNotAllowed("POST");
		}

		if (!agent.configured) {
			return missingConfiguration();
		}

		const message = await readMessage(request);
		if (!message) {
			return json({ message: "Message is required." }, 400);
		}

		try {
			const stream = await agent.openStream(message);
			return new Response(stream, { headers: STREAM_HEADERS });
		} catch (error) {
			return errorResponse(error);
		}
	}

	return json({ message: "Not found." }, 404);
}

async function readMessage(request: Request): Promise<string | null> {
	const payload = (await request.json().catch(() => null)) as {
		message?: string;
	} | null;
	const message = payload?.message?.trim();
	return message ? message : null;
}

function missingConfiguration(): Response {
	return json(
		{
			message:
				"Missing Portacall agent configuration. Provide agentId and secretKey.",
		},
		500,
	);
}

function methodNotAllowed(method: string): Response {
	return new Response(JSON.stringify({ message: "Method not allowed." }), {
		status: 405,
		headers: {
			allow: method,
			"content-type": "application/json; charset=utf-8",
		},
	});
}

function errorResponse(error: unknown): Response {
	const status =
		error instanceof Error &&
		"status" in error &&
		typeof error.status === "number"
			? error.status
			: 500;
	const code =
		error instanceof Error && "code" in error && typeof error.code === "string"
			? error.code
			: undefined;
	const message =
		error instanceof Error ? error.message : "Unknown Portacall error.";

	return json({ message, code, status }, status);
}

function trimTrailingSlash(pathname: string): string {
	return pathname.length > 1 && pathname.endsWith("/")
		? pathname.slice(0, -1)
		: pathname;
}

function json(payload: unknown, status = 200): Response {
	return new Response(JSON.stringify(payload), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
		},
	});
}
