import {
	decodeBase64Url,
	encodeBase64Url,
	isNonEmptyString,
	isRecord,
	timingSafeEqual,
	toHex,
} from "./shared";

type PortacallAuthHandoffEnvelope = {
	v: 1;
	adapter: string;
	iat: number;
	exp: number;
	nonce: string;
	payload: Record<string, unknown>;
};

export type ReadPortacallAuthHandoffResult =
	| {
			ok: true;
			adapter: string;
			payload: Record<string, unknown>;
			issuedAt: number;
			expiresAt: number;
			nonce: string;
	  }
	| {
			ok: false;
			code:
				| "expired_auth_handoff"
				| "invalid_auth_handoff"
				| "invalid_auth_handoff_signature";
			message: string;
	  };

export async function createPortacallAuthHandoff(input: {
	adapter: string;
	payload: Record<string, unknown>;
	secret: string;
	ttlSeconds: number;
	now?: number;
}): Promise<string> {
	const issuedAt = input.now ?? Date.now();
	const expiresAt = issuedAt + input.ttlSeconds * 1000;
	const envelope: PortacallAuthHandoffEnvelope = {
		v: 1,
		adapter: input.adapter,
		iat: issuedAt,
		exp: expiresAt,
		nonce: crypto.randomUUID(),
		payload: input.payload,
	};
	const body = JSON.stringify(envelope);
	const encodedBody = encodeBase64Url(body);
	const signature = await signAuthHandoff(encodedBody, input.secret);
	return `v1.${encodedBody}.${signature}`;
}

export async function readPortacallAuthHandoff(input: {
	token: string;
	secret: string;
	now?: number;
}): Promise<ReadPortacallAuthHandoffResult> {
	const [version, encodedBody, signature] = input.token.split(".", 3);
	if (version !== "v1" || !encodedBody || !signature) {
		return {
			ok: false,
			code: "invalid_auth_handoff",
			message: "Portacall auth handoff token is malformed.",
		};
	}

	const expectedSignature = await signAuthHandoff(encodedBody, input.secret);
	if (!timingSafeEqual(expectedSignature, signature)) {
		return {
			ok: false,
			code: "invalid_auth_handoff_signature",
			message: "Portacall auth handoff signature verification failed.",
		};
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(decodeBase64Url(encodedBody));
	} catch {
		return {
			ok: false,
			code: "invalid_auth_handoff",
			message: "Portacall auth handoff payload is invalid JSON.",
		};
	}

	if (!isAuthHandoffEnvelope(parsed)) {
		return {
			ok: false,
			code: "invalid_auth_handoff",
			message: "Portacall auth handoff payload is invalid.",
		};
	}

	const now = input.now ?? Date.now();
	if (parsed.exp < now) {
		return {
			ok: false,
			code: "expired_auth_handoff",
			message: "Portacall auth handoff token has expired.",
		};
	}

	return {
		ok: true,
		adapter: parsed.adapter,
		payload: parsed.payload,
		issuedAt: parsed.iat,
		expiresAt: parsed.exp,
		nonce: parsed.nonce,
	};
}

async function signAuthHandoff(body: string, secret: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
	return toHex(new Uint8Array(signature));
}

function isAuthHandoffEnvelope(
	value: unknown,
): value is PortacallAuthHandoffEnvelope {
	return (
		isRecord(value) &&
		value.v === 1 &&
		isNonEmptyString(value.adapter) &&
		typeof value.iat === "number" &&
		Number.isFinite(value.iat) &&
		typeof value.exp === "number" &&
		Number.isFinite(value.exp) &&
		isNonEmptyString(value.nonce) &&
		isRecord(value.payload)
	);
}

const encoder = new TextEncoder();
