import { describe, expect, test } from "bun:test";
import { createAuthJsAdapter } from "./authjs";

describe("@portacall/server/auth/authjs", () => {
	test("captures and restores an Auth.js session", async () => {
		const adapter = createAuthJsAdapter({
			getSession: async () => ({
				user: { id: "user_123" },
				expires: "2026-04-15T00:00:00.000Z",
			}),
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
			expires: "2026-04-15T00:00:00.000Z",
		});
	});
});
