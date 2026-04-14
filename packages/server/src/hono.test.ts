import { describe, expect, test } from "bun:test";
import { createPortacallHono } from "./hono";

describe("@portacall/server/hono", () => {
	test("creates hono helpers for an agent", () => {
		const toolRegistrations: string[] = [];
		const helpers = createPortacallHono({
			id: "agent_123",
			handler: async () => new Response("ok"),
			webhook: async () => new Response("ok"),
			completeToolRun: async () => ({
				toolRun: {} as never,
				event: {} as never,
				conversation: {} as never,
			}),
			syncTools: async () => ({ tools: [] }),
			registerTool(definition) {
				toolRegistrations.push(definition.name);
				return {
					id: definition.id ?? "tool_123",
					name: definition.name,
					description: definition.description,
					requiresConfirmation: definition.requiresConfirmation ?? false,
					completionMode: definition.completionMode ?? "accept_immediately",
					requiresAuth: definition.requiresAuth ?? false,
				};
			},
			getRegisteredTools: () => [],
		});

		expect(typeof helpers.handler).toBe("function");
		expect(typeof helpers.webhook).toBe("function");
		expect(typeof helpers.toolRoute).toBe("function");
		helpers.toolRoute({
			tool: {
				name: "cancel_order",
				description: "Cancel an order",
			},
			fromHttp: async () => ({ orderId: "123" }),
			fromTool: async () => ({ orderId: "123" }),
			execute: async () => ({ ok: true }),
		});
		expect(toolRegistrations).toEqual(["cancel_order"]);
	});
});
