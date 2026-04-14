import type { PortacallAuthAdapter } from "../types";

type AuthJsSessionLike = {
	user?: Record<string, unknown>;
	expires?: string;
	[key: string]: unknown;
};

export type AuthJsAdapterOptions<Session extends AuthJsSessionLike> = {
	getSession: (request: Request) => Promise<Session | null> | Session | null;
	mapSession?: (
		session: Session,
	) => Record<string, unknown> | Promise<Record<string, unknown>>;
	restoreSession?: (
		payload: Record<string, unknown>,
	) => Session | null | Promise<Session | null>;
};

export function createAuthJsAdapter<Session extends AuthJsSessionLike>(
	options: AuthJsAdapterOptions<Session>,
): PortacallAuthAdapter<Record<string, unknown>, Session> {
	return {
		name: "authjs",
		capture: async ({ request }) => {
			const session = await options.getSession(request);
			if (!session) {
				return null;
			}

			return options.mapSession ? options.mapSession(session) : { session };
		},
		serialize: async ({ authContext }) => authContext,
		restore: async ({ payload }) => {
			if (options.restoreSession) {
				return options.restoreSession(payload);
			}

			return isSessionLike(payload.session)
				? (payload.session as Session)
				: null;
		},
		onMissingAuth: async () => ({
			status: "failed",
			error: {
				message: "An Auth.js session is required for this tool.",
				code: "missing_authjs_session",
			},
		}),
	};
}

function isSessionLike(value: unknown): value is AuthJsSessionLike {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
