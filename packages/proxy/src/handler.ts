type PortacallProxyHandler = {
	configured: boolean;
	chat(
		agentId: string,
		message: string,
		conversationId?: string,
	): Promise<{ content: string; conversationId: string }>;
	openStream(
		agentId: string,
		message: string,
		conversationId?: string,
	): Promise<{ stream: ReadableStream<Uint8Array>; conversationId: string }>;
};

const STREAM_HEADERS = {
	"cache-control": "no-cache, no-transform",
	"content-type": "text/plain; charset=utf-8",
	"x-content-type-options": "nosniff",
};

export async function handlePortacallRequest(
	portacall: PortacallProxyHandler,
	request: Request,
): Promise<Response> {
	const url = new URL(request.url);
	const route = matchPortacallRoute(trimTrailingSlash(url.pathname));

	if (!route) {
		return json({ message: "Not found." }, 404);
	}

	if (route.action === "health") {
		return request.method === "GET"
			? json({ ok: true, configured: portacall.configured })
			: methodNotAllowed("GET");
	}

	if (route.action === "chat") {
		if (request.method !== "POST") {
			return methodNotAllowed("POST");
		}

		if (!portacall.configured) {
			return missingConfiguration();
		}

		const payload = await readChatInput(request);
		if (!payload) {
			return json({ message: "Message is required." }, 400);
		}

		try {
			const response = await portacall.chat(
				route.agentId,
				payload.message,
				payload.conversationId,
			);
			return json(response);
		} catch (error) {
			return errorResponse(error);
		}
	}

	if (route.action === "stream") {
		if (request.method !== "POST") {
			return methodNotAllowed("POST");
		}

		if (!portacall.configured) {
			return missingConfiguration();
		}

		const payload = await readChatInput(request);
		if (!payload) {
			return json({ message: "Message is required." }, 400);
		}

		try {
			const response = await portacall.openStream(
				route.agentId,
				payload.message,
				payload.conversationId,
			);
			return new Response(response.stream, {
				headers: {
					...STREAM_HEADERS,
					"x-portacall-conversation-id": response.conversationId,
				},
			});
		} catch (error) {
			return errorResponse(error);
		}
	}

	return json({ message: "Not found." }, 404);
}

async function readChatInput(
	request: Request,
): Promise<{ message: string; conversationId?: string } | null> {
	const payload = (await request.json().catch(() => null)) as {
		message?: string;
		conversationId?: string;
	} | null;
	const message = payload?.message?.trim();
	if (!message) {
		return null;
	}

	const conversationId = payload?.conversationId?.trim();
	return conversationId ? { message, conversationId } : { message };
}

function missingConfiguration(): Response {
	return json(
		{
			message: "Missing Portacall configuration. Provide secretKey.",
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

function matchPortacallRoute(
	pathname: string,
): { agentId: string; action: "health" | "chat" | "stream" } | null {
	const segments = pathname.split("/").filter(Boolean);
	if (segments.length < 4) {
		return null;
	}

	const action = segments[segments.length - 1];
	if (action !== "health" && action !== "chat" && action !== "stream") {
		return null;
	}

	const encodedAgentId = segments[segments.length - 2];
	if (!encodedAgentId) {
		return null;
	}

	try {
		return {
			agentId: decodeURIComponent(encodedAgentId),
			action,
		};
	} catch {
		return null;
	}
}

function json(payload: unknown, status = 200): Response {
	return new Response(JSON.stringify(payload), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
		},
	});
}
