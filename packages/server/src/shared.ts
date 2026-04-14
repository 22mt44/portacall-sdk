import { PortacallError, type PortacallErrorPayload } from "./errors";

export function normalizeMessage(message: string): string {
	const trimmedMessage = message.trim();
	if (!trimmedMessage) {
		throw new Error("Message is required.");
	}

	return trimmedMessage;
}

export async function createRequestError(
	response: Response,
	fallbackMessage: string,
): Promise<PortacallError> {
	const text = await response.text();
	if (!text) {
		return new PortacallError(fallbackMessage, { status: response.status });
	}

	try {
		const payload = JSON.parse(text) as PortacallErrorPayload;
		return new PortacallError(payload.message ?? fallbackMessage, {
			status: response.status,
			code: payload.code,
		});
	} catch {
		return new PortacallError(text, { status: response.status });
	}
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

export function json(payload: unknown, status = 200): Response {
	return new Response(JSON.stringify(payload), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
		},
	});
}

export function methodNotAllowed(method: string): Response {
	return new Response(JSON.stringify({ message: "Method not allowed." }), {
		status: 405,
		headers: {
			allow: method,
			"content-type": "application/json; charset=utf-8",
		},
	});
}

export function timingSafeEqual(left: string, right: string): boolean {
	if (left.length !== right.length) {
		return false;
	}

	let mismatch = 0;
	for (let index = 0; index < left.length; index += 1) {
		mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
	}

	return mismatch === 0;
}

export function toHex(value: Uint8Array): string {
	return Array.from(value)
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

export function encodeBase64Url(value: string): string {
	const bytes = textEncoder.encode(value);
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/g, "");
}

export function decodeBase64Url(value: string): string {
	const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
	const padding = normalized.length % 4;
	const padded =
		padding === 0 ? normalized : `${normalized}${"=".repeat(4 - padding)}`;
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}

	return textDecoder.decode(bytes);
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
