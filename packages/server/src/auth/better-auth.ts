import type { PortacallAuthAdapter } from "../types";

type BetterAuthSessionLike = {
	user?: Record<string, unknown>;
	session?: Record<string, unknown>;
	[key: string]: unknown;
};

type BetterAuthLike<Session extends BetterAuthSessionLike> = {
	api: {
		getSession(input: {
			headers: Headers;
		}): Promise<Session | null> | Session | null;
	};
};

export type BetterAuthAdapterOptions<Session extends BetterAuthSessionLike> = {
	auth: BetterAuthLike<Session>;
	mapSession?: (
		session: Session,
	) => Record<string, unknown> | Promise<Record<string, unknown>>;
	restoreSession?: (
		payload: Record<string, unknown>,
	) => Session | null | Promise<Session | null>;
};

export function createBetterAuthAdapter<Session extends BetterAuthSessionLike>(
	options: BetterAuthAdapterOptions<Session>,
): PortacallAuthAdapter<Record<string, unknown>, Session> {
	return {
		name: "better-auth",
		capture: async ({ request }) => {
			const session = await options.auth.api.getSession({
				headers: request.headers,
			});
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
				message: "A Better Auth session is required for this tool.",
				code: "missing_better_auth_session",
			},
		}),
	};
}

function isSessionLike(value: unknown): value is BetterAuthSessionLike {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
