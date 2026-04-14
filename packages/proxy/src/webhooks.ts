export type PortacallToolWebhookEvent = {
	version: string;
	type: "tool.requested";
	toolRunId: string;
	agentId: string;
	tool: {
		name: string;
		description: string;
	};
	args: Record<string, unknown>;
	actor: Record<string, unknown>;
	meta: {
		timestamp: string;
		requestId: string;
		conversationId?: string;
		requiresConfirmation: boolean;
		completionMode?: "accept_immediately" | "wait_for_result";
	};
};

export type PortacallToolWebhookError = {
	message: string;
	code?: string;
};

export type PortacallToolWebhookResponse =
	| {
			status: "accepted" | "completed";
			message?: string;
			output?: unknown;
	  }
	| {
			status: "failed";
			message?: string;
			error: PortacallToolWebhookError;
	  };

export type HandlePortacallWebhookOptions = {
	secret: string;
	maxAgeSeconds?: number;
	onTool: (
		event: PortacallToolWebhookEvent,
	) => PortacallToolWebhookResponse | Promise<PortacallToolWebhookResponse>;
};

const DEFAULT_MAX_AGE_SECONDS = 300;

export async function handlePortacallWebhook(
	request: Request,
	options: HandlePortacallWebhookOptions,
): Promise<Response> {
	if (request.method !== "POST") {
		return methodNotAllowed("POST");
	}

	const secret = options.secret.trim();
	if (!secret) {
		return json(
			{ message: "Missing Portacall webhook secret.", code: "missing_secret" },
			500,
		);
	}

	const timestamp = request.headers.get("x-portacall-timestamp");
	const signatureHeader = request.headers.get("x-portacall-signature");
	if (!timestamp || !signatureHeader) {
		return json(
			{
				message: "Missing Portacall webhook signature headers.",
				code: "missing_signature_headers",
			},
			401,
		);
	}

	if (
		!isTimestampFresh(
			timestamp,
			options.maxAgeSeconds ?? DEFAULT_MAX_AGE_SECONDS,
		)
	) {
		return json(
			{
				message: "Portacall webhook timestamp is invalid or expired.",
				code: "invalid_timestamp",
			},
			401,
		);
	}

	const body = await request.text();
	const signature = normalizeSignature(signatureHeader);
	const verified = await verifyPortacallWebhookSignature({
		body,
		secret,
		signature,
		timestamp,
	});

	if (!verified) {
		return json(
			{
				message: "Portacall webhook signature verification failed.",
				code: "invalid_signature",
			},
			401,
		);
	}

	let payload: unknown;
	try {
		payload = JSON.parse(body);
	} catch {
		return json(
			{ message: "Invalid Portacall webhook JSON body.", code: "invalid_json" },
			400,
		);
	}

	if (!isPortacallToolWebhookEvent(payload)) {
		return json(
			{
				message: "Invalid Portacall webhook payload.",
				code: "invalid_payload",
			},
			400,
		);
	}

	try {
		const response = normalizeWebhookResponse(await options.onTool(payload));
		return json(response);
	} catch (error) {
		return json(
			{
				status: "failed",
				error: {
					message:
						error instanceof Error
							? error.message
							: "Unhandled Portacall webhook error.",
					code: "handler_error",
				},
			} satisfies PortacallToolWebhookResponse,
			500,
		);
	}
}

export async function createPortacallWebhookSignature(input: {
	body: string;
	secret: string;
	timestamp: string;
}): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(input.secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		encoder.encode(`${input.timestamp}.${input.body}`),
	);

	return toHex(new Uint8Array(signature));
}

export async function verifyPortacallWebhookSignature(input: {
	body: string;
	secret: string;
	signature: string;
	timestamp: string;
}): Promise<boolean> {
	const expectedSignature = await createPortacallWebhookSignature(input);
	return timingSafeEqual(expectedSignature, input.signature);
}

const encoder = new TextEncoder();

function normalizeWebhookResponse(
	response: PortacallToolWebhookResponse,
): PortacallToolWebhookResponse {
	if (response.status === "failed") {
		return {
			status: "failed",
			message: response.message,
			error: {
				message: response.error.message,
				code: response.error.code,
			},
		};
	}

	return {
		status: response.status,
		message: response.message,
		output: response.output,
	};
}

function isPortacallToolWebhookEvent(
	value: unknown,
): value is PortacallToolWebhookEvent {
	if (!isRecord(value)) {
		return false;
	}

	if (
		!isNonEmptyString(value.version) ||
		value.type !== "tool.requested" ||
		!isNonEmptyString(value.toolRunId) ||
		!isNonEmptyString(value.agentId) ||
		!isRecord(value.tool) ||
		!isNonEmptyString(value.tool.name) ||
		!isNonEmptyString(value.tool.description) ||
		!isRecord(value.args) ||
		!isRecord(value.actor) ||
		!isRecord(value.meta) ||
		!isNonEmptyString(value.meta.timestamp) ||
		!isNonEmptyString(value.meta.requestId) ||
		typeof value.meta.requiresConfirmation !== "boolean"
	) {
		return false;
	}

	if (
		value.meta.conversationId !== undefined &&
		typeof value.meta.conversationId !== "string"
	) {
		return false;
	}

	if (
		value.meta.completionMode !== undefined &&
		value.meta.completionMode !== "accept_immediately" &&
		value.meta.completionMode !== "wait_for_result"
	) {
		return false;
	}

	return true;
}

function isTimestampFresh(timestamp: string, maxAgeSeconds: number): boolean {
	const value = Number(timestamp);
	if (!Number.isFinite(value)) {
		return false;
	}

	const timestampMs = value * 1000;
	return Math.abs(Date.now() - timestampMs) <= maxAgeSeconds * 1000;
}

function normalizeSignature(signatureHeader: string): string {
	const [version, value] = signatureHeader.split("=", 2);
	if (value && version === "v1") {
		return value;
	}

	return signatureHeader;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
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

function json(payload: unknown, status = 200): Response {
	return new Response(JSON.stringify(payload), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
		},
	});
}

function toHex(value: Uint8Array): string {
	return Array.from(value)
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

function timingSafeEqual(left: string, right: string): boolean {
	if (left.length !== right.length) {
		return false;
	}

	let mismatch = 0;
	for (let index = 0; index < left.length; index += 1) {
		mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
	}

	return mismatch === 0;
}
