import { describe, expect, test } from "bun:test";
import { createBetterAuthAdapter } from "./better-auth";

describe("@portacall/server/auth/better-auth", () => {
	test("captures and restores a Better Auth session", async () => {
		const adapter = createBetterAuthAdapter({
			auth: {
				api: {
					getSession: async () => ({
						user: { id: "user_123" },
						session: { id: "session_123" },
					}),
				},
			},
		});

		const captured = await adapter.capture({
			agentId: "agent_123",
			externalUserId: "user_123",
			request: new Request("https://example.com"),
		});
		const restored = await adapter.restore({
			event: {} as never,
			payload: captured ?? {},
		});

		expect(restored).toEqual({
			user: { id: "user_123" },
			session: { id: "session_123" },
		});
	});
});
