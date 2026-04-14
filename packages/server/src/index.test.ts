import { describe, expect, test } from "bun:test";
import {
	createPortacallAuthHandoff,
	createPortacallServer,
	createPortacallWebhookSignature,
	type PortacallAuthAdapter,
} from "./index";

const conversationId = "18e40f1f-490d-4ee9-9d31-c6da546dac66";

describe("@portacall/server", () => {
	test("agent.handler returns health status", async () => {
		const server = createPortacallServer({
			secretKey: "",
			fetch: async () =>
				new Response(JSON.stringify({ content: "unused" }), {
					status: 200,
					headers: { "content-type": "application/json; charset=utf-8" },
				}),
		});

		const response = await server
			.agent("agent_123")
			.handler(
				new Request("https://example.com/api/portacall/agent_123/health"),
			);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			ok: true,
			configured: false,
		});
	});

	test("agent.handler forwards chat requests and includes auth handoff headers", async () => {
		let receivedURL = "";
		let receivedInit: RequestInit | undefined;
		const auth: PortacallAuthAdapter<
			{ sessionId: string },
			{ sessionId: string }
		> = {
			name: "test-auth",
			capture: async () => ({ sessionId: "session_123" }),
			serialize: async ({ authContext }) => authContext,
			restore: async ({ payload }) => ({
				sessionId: String(payload.sessionId),
			}),
		};

		const server = createPortacallServer({
			secretKey: "sk_test_123",
			handoffSecret: "handoff_test_123",
			auth,
			baseURL: "https://example.com",
			fetch: async (input, init) => {
				receivedURL = String(input);
				receivedInit = init;
				return new Response(
					JSON.stringify({
						content: "Handled by SDK",
						conversationId,
						events: [
							{ type: "conversation_id", conversationId },
							{ type: "message_completed", conversationId },
						],
					}),
					{
						status: 200,
						headers: { "content-type": "application/json; charset=utf-8" },
					},
				);
			},
		});

		const response = await server.agent("agent_123").handler(
			new Request("https://backend.example.com/api/portacall/agent_123/chat", {
				method: "POST",
				headers: {
					"content-type": "application/json; charset=utf-8",
					cookie: "session=test",
				},
				body: JSON.stringify({
					message: "Hello from handler",
					externalUserId: "user_123",
				}),
			}),
		);

		expect(receivedURL).toBe(
			"https://example.com/api/portacall/agent_123/chat",
		);
		expect(receivedInit?.method).toBe("POST");
		const headers = receivedInit?.headers as Record<string, string>;
		expect(headers.authorization).toBe("Bearer sk_test_123");
		expect(headers["x-portacall-auth-handoff"]).toContain("v1.");
		expect(receivedInit?.body).toBe(
			JSON.stringify({
				message: "Hello from handler",
				externalUserId: "user_123",
			}),
		);
		expect(response.status).toBe(200);
	});

	test("syncTools sends registered tools to the Portacall API", async () => {
		let receivedURL = "";
		let receivedInit: RequestInit | undefined;

		const server = createPortacallServer({
			secretKey: "sk_test_123",
			baseURL: "https://example.com",
			fetch: async (input, init) => {
				receivedURL = String(input);
				receivedInit = init;
				return new Response(
					JSON.stringify({
						tools: [
							{
								id: "tool_123",
								name: "cancel_order",
								description: "Cancel an order",
								requiresConfirmation: false,
								completionMode: "wait_for_result",
							},
						],
					}),
					{
						status: 200,
						headers: { "content-type": "application/json; charset=utf-8" },
					},
				);
			},
		});
		const agent = server.agent("agent_123");
		agent.registerTool(
			{
				id: "tool_123",
				name: "cancel_order",
				description: "Cancel an order",
				completionMode: "wait_for_result",
			},
			async () => ({
				status: "completed",
			}),
		);

		await expect(agent.syncTools()).resolves.toEqual({
			tools: [
				{
					id: "tool_123",
					name: "cancel_order",
					description: "Cancel an order",
					requiresConfirmation: false,
					completionMode: "wait_for_result",
				},
			],
		});
		expect(receivedURL).toBe(
			"https://example.com/api/portacall/agent_123/tools/sync",
		);
		expect(receivedInit?.method).toBe("POST");
		expect(receivedInit?.body).toBe(
			JSON.stringify({
				tools: [
					{
						id: "tool_123",
						name: "cancel_order",
						description: "Cancel an order",
						requiresConfirmation: false,
						completionMode: "wait_for_result",
					},
				],
			}),
		);
	});

	test("agent.webhook restores auth context and runs a registered tool", async () => {
		const auth: PortacallAuthAdapter<
			{ sessionId: string },
			{ sessionId: string }
		> = {
			name: "test-auth",
			capture: async () => ({ sessionId: "session_123" }),
			serialize: async ({ authContext }) => authContext,
			restore: async ({ payload }) => ({
				sessionId: String(payload.sessionId),
			}),
		};

		const server = createPortacallServer({
			secretKey: "sk_test_123",
			webhookSecret: "whsec_123",
			handoffSecret: "handoff_test_123",
			auth,
			fetch: async () =>
				new Response(JSON.stringify({ ok: true }), {
					status: 200,
					headers: { "content-type": "application/json; charset=utf-8" },
				}),
		});
		const agent = server.agent("agent_123");
		let receivedAuth: { sessionId: string } | null = null;
		agent.registerTool(
			{
				name: "cancel_order",
				description: "Cancel an order",
				requiresAuth: true,
			},
			async ({ auth }) => {
				receivedAuth = auth;
				return {
					status: "completed",
					message: "Order canceled.",
				};
			},
		);

		const handoff = await server
			.agent("agent_123")
			.handler(
				new Request(
					"https://backend.example.com/api/portacall/agent_123/chat",
					{
						method: "POST",
						headers: {
							"content-type": "application/json; charset=utf-8",
						},
						body: JSON.stringify({
							message: "Trigger",
							externalUserId: "user_123",
						}),
					},
				),
			)
			.then(() => "unused");
		expect(handoff).toBe("unused");

		const timestamp = Math.floor(Date.now() / 1000).toString();
		const encoded = await auth.serialize({
			agentId: "agent_123",
			externalUserId: "user_123",
			request: new Request("https://example.com"),
			authContext: { sessionId: "session_123" },
		});
		const authHandoff = await createPortacallAuthHandoff({
			adapter: auth.name,
			payload: encoded,
			secret: "handoff_test_123",
			ttlSeconds: 300,
		});
		const body = JSON.stringify({
			version: "2026-03-27",
			type: "tool.requested",
			toolRunId: "tool_run_123",
			agentId: "agent_123",
			tool: {
				name: "cancel_order",
				description: "Cancel an order",
			},
			args: {
				summary: "Cancel order #12345",
				payload: {
					orderId: "12345",
				},
				payloadJson: '{"orderId":"12345"}',
			},
			actor: {
				accountUserId: "account_user_123",
				accountEmail: "owner@example.com",
			},
			meta: {
				timestamp: new Date().toISOString(),
				requestId: "tool_run_123",
				externalUserId: "user_123",
				authHandoff,
				requiresConfirmation: false,
				completionMode: "wait_for_result",
			},
		});
		const signature = await createPortacallWebhookSignature({
			body,
			secret: "whsec_123",
			timestamp,
		});

		const response = await agent.webhook(
			new Request("https://backend.example.com/api/portacall/webhooks", {
				method: "POST",
				headers: {
					"content-type": "application/json; charset=utf-8",
					"x-portacall-timestamp": timestamp,
					"x-portacall-signature": `v1=${signature}`,
				},
				body,
			}),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			status: "completed",
			message: "Order canceled.",
		});
		expect(receivedAuth as { sessionId: string } | null).toEqual({
			sessionId: "session_123",
		});
	});
});
