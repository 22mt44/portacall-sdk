import { describe, expect, test } from "bun:test";
import { createPortacallExpress } from "./adapters/express";
import { portacall } from "./portacall";

const conversationId = "18e40f1f-490d-4ee9-9d31-c6da546dac66";

describe("portacall proxy", () => {
	test("handler returns health status", async () => {
		const proxy = portacall("", {
			fetch: async () =>
				new Response(JSON.stringify({ content: "unused" }), {
					status: 200,
					headers: { "content-type": "application/json; charset=utf-8" },
				}),
		});

		const response = await proxy.handler(
			new Request("https://example.com/api/portacall/agent_123/health"),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			ok: true,
			configured: false,
		});
	});

	test("handler returns not found for an invalid route", async () => {
		const proxy = portacall("sk_test_123", {
			fetch: async () =>
				new Response(JSON.stringify({ content: "unused" }), {
					status: 200,
					headers: { "content-type": "application/json; charset=utf-8" },
				}),
		});

		const response = await proxy.handler(
			new Request("https://example.com/api/portacall/health"),
		);

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toEqual({
			message: "Not found.",
		});
	});

	test("completeActionRun forwards asynchronous completion payloads", async () => {
		let receivedURL = "";
		let receivedInit: RequestInit | undefined;
		const proxy = portacall("sk_test_123", {
			baseURL: "https://example.com",
			fetch: async (input, init) => {
				receivedURL = String(input);
				receivedInit = init;

				return new Response(
					JSON.stringify({
						actionRun: {
							id: "action_run_123",
							conversationId,
							agentId: "agent_123",
							externalUserId: "user_123",
							toolCallId: "tool_123",
							actionName: "cancel_order",
							summary: "Cancel order #12345",
							payload: { orderId: "12345" },
							payloadJson: '{"orderId":"12345"}',
							status: "completed",
							decision: "approved",
							message: "Order canceled.",
							errorCode: null,
							output: { orderId: "12345", canceled: true },
							createdAt: "2026-03-27T10:05:00.000Z",
							updatedAt: "2026-03-27T10:07:00.000Z",
							resolvedAt: "2026-03-27T10:07:00.000Z",
						},
						event: {
							type: "action_completed",
							actionRun: {
								id: "action_run_123",
								conversationId,
								agentId: "agent_123",
								externalUserId: "user_123",
								toolCallId: "tool_123",
								actionName: "cancel_order",
								summary: "Cancel order #12345",
								payload: { orderId: "12345" },
								payloadJson: '{"orderId":"12345"}',
								status: "completed",
								decision: "approved",
								message: "Order canceled.",
								errorCode: null,
								output: { orderId: "12345", canceled: true },
								createdAt: "2026-03-27T10:05:00.000Z",
								updatedAt: "2026-03-27T10:07:00.000Z",
								resolvedAt: "2026-03-27T10:07:00.000Z",
							},
						},
						conversation: {
							id: conversationId,
							title: "Support thread",
							createdAt: "2026-03-27T10:00:00.000Z",
							updatedAt: "2026-03-27T10:07:01.000Z",
							lastMessageAt: "2026-03-27T10:07:01.000Z",
							archivedAt: null,
						},
					}),
					{
						status: 200,
						headers: { "content-type": "application/json; charset=utf-8" },
					},
				);
			},
		});

		await expect(
			proxy.completeActionRun("agent_123", "action_run_123", {
				status: "completed",
				message: "Order canceled.",
				output: { orderId: "12345", canceled: true },
			}),
		).resolves.toMatchObject({
			actionRun: {
				id: "action_run_123",
				status: "completed",
			},
			event: {
				type: "action_completed",
			},
		});
		expect(receivedURL).toBe(
			"https://example.com/api/portacall/agent_123/action-runs/action_run_123/complete",
		);
		expect(receivedInit?.method).toBe("POST");
		expect(receivedInit?.headers).toEqual({
			"content-type": "application/json; charset=utf-8",
			authorization: "Bearer sk_test_123",
		});
		expect(receivedInit?.body).toBe(
			JSON.stringify({
				status: "completed",
				message: "Order canceled.",
				output: { orderId: "12345", canceled: true },
			}),
		);
	});

	test("handler proxies chat requests to the Portacall API", async () => {
		let receivedURL = "";
		let receivedInit: RequestInit | undefined;

		const proxy = portacall("sk_test_123", {
			baseURL: "https://example.com",
			fetch: async (input, init) => {
				receivedURL = String(input);
				receivedInit = init;

				return new Response(
					JSON.stringify({
						content: "Handled by SDK",
						conversationId,
						events: [
							{
								type: "conversation_id",
								conversationId,
							},
							{
								type: "text_delta",
								text: "Handled by SDK",
							},
							{
								type: "message_completed",
								conversationId,
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

		const response = await proxy.handler(
			new Request("https://backend.example.com/api/portacall/agent_123/chat", {
				method: "POST",
				headers: {
					"content-type": "application/json; charset=utf-8",
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
		expect(receivedInit?.headers).toEqual({
			"content-type": "application/json; charset=utf-8",
			authorization: "Bearer sk_test_123",
		});
		expect(receivedInit?.body).toBe(
			JSON.stringify({
				message: "Hello from handler",
				externalUserId: "user_123",
			}),
		);
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			content: "Handled by SDK",
			conversationId,
			events: [
				{
					type: "conversation_id",
					conversationId,
				},
				{
					type: "text_delta",
					text: "Handled by SDK",
				},
				{
					type: "message_completed",
					conversationId,
				},
			],
		});
	});

	test("handler proxies conversation list requests to the Portacall API", async () => {
		let receivedURL = "";
		let receivedInit: RequestInit | undefined;

		const proxy = portacall("sk_test_123", {
			baseURL: "https://example.com",
			fetch: async (input, init) => {
				receivedURL = String(input);
				receivedInit = init;

				return new Response(
					JSON.stringify({
						conversations: [
							{
								id: conversationId,
								title: "Support thread",
								createdAt: "2026-03-27T10:00:00.000Z",
								updatedAt: "2026-03-27T10:05:00.000Z",
								lastMessageAt: "2026-03-27T10:05:00.000Z",
								archivedAt: null,
							},
						],
						pagination: {
							limit: 25,
							offset: 10,
							hasMore: true,
						},
					}),
					{
						status: 200,
						headers: { "content-type": "application/json; charset=utf-8" },
					},
				);
			},
		});

		const response = await proxy.handler(
			new Request(
				"https://backend.example.com/api/portacall/agent_123/conversations?externalUserId=user_123&limit=25&offset=10&includeArchived=true",
			),
		);

		expect(receivedURL).toBe(
			"https://example.com/api/portacall/agent_123/conversations?externalUserId=user_123&limit=25&offset=10&includeArchived=true",
		);
		expect(receivedInit?.method).toBe("GET");
		expect(receivedInit?.headers).toEqual({
			authorization: "Bearer sk_test_123",
		});
		await expect(response.json()).resolves.toEqual({
			conversations: [
				{
					id: conversationId,
					title: "Support thread",
					createdAt: "2026-03-27T10:00:00.000Z",
					updatedAt: "2026-03-27T10:05:00.000Z",
					lastMessageAt: "2026-03-27T10:05:00.000Z",
					archivedAt: null,
				},
			],
			pagination: {
				limit: 25,
				offset: 10,
				hasMore: true,
			},
		});
	});

	test("handler creates conversations through the Portacall API", async () => {
		let receivedURL = "";
		let receivedInit: RequestInit | undefined;

		const proxy = portacall("sk_test_123", {
			baseURL: "https://example.com",
			fetch: async (input, init) => {
				receivedURL = String(input);
				receivedInit = init;

				return new Response(
					JSON.stringify({
						conversation: {
							id: conversationId,
							title: "Support thread",
							createdAt: "2026-03-27T10:00:00.000Z",
							updatedAt: "2026-03-27T10:05:00.000Z",
							lastMessageAt: "2026-03-27T10:05:00.000Z",
							archivedAt: null,
						},
					}),
					{
						status: 201,
						headers: { "content-type": "application/json; charset=utf-8" },
					},
				);
			},
		});

		const response = await proxy.handler(
			new Request(
				"https://backend.example.com/api/portacall/agent_123/conversations",
				{
					method: "POST",
					headers: {
						"content-type": "application/json; charset=utf-8",
					},
					body: JSON.stringify({
						externalUserId: "  user_123  ",
						title: "  Support thread  ",
					}),
				},
			),
		);

		expect(receivedURL).toBe(
			"https://example.com/api/portacall/agent_123/conversations",
		);
		expect(receivedInit?.method).toBe("POST");
		expect(receivedInit?.body).toBe(
			JSON.stringify({
				externalUserId: "user_123",
				title: "Support thread",
			}),
		);
		expect(response.status).toBe(201);
		await expect(response.json()).resolves.toEqual({
			conversation: {
				id: conversationId,
				title: "Support thread",
				createdAt: "2026-03-27T10:00:00.000Z",
				updatedAt: "2026-03-27T10:05:00.000Z",
				lastMessageAt: "2026-03-27T10:05:00.000Z",
				archivedAt: null,
			},
		});
	});

	test("handler proxies conversation message history requests", async () => {
		let receivedURL = "";

		const proxy = portacall("sk_test_123", {
			baseURL: "https://example.com",
			fetch: async (input) => {
				receivedURL = String(input);

				return new Response(
					JSON.stringify({
						conversation: {
							id: conversationId,
							title: "Support thread",
							createdAt: "2026-03-27T10:00:00.000Z",
							updatedAt: "2026-03-27T10:05:00.000Z",
							lastMessageAt: "2026-03-27T10:05:00.000Z",
							archivedAt: null,
						},
						messages: [
							{
								id: "f55cf2a2-7067-4437-90cc-51b6d55861e0",
								role: "user",
								content: "Hello there",
								createdAt: "2026-03-27T10:00:00.000Z",
							},
						],
						pagination: {
							limit: 20,
							offset: 5,
							hasMore: false,
						},
					}),
					{
						status: 200,
						headers: { "content-type": "application/json; charset=utf-8" },
					},
				);
			},
		});

		const response = await proxy.handler(
			new Request(
				`https://backend.example.com/api/portacall/agent_123/conversations/${conversationId}/messages?externalUserId=user_123&limit=20&offset=5`,
			),
		);

		expect(receivedURL).toBe(
			`https://example.com/api/portacall/agent_123/conversations/${conversationId}/messages?externalUserId=user_123&limit=20&offset=5`,
		);
		await expect(response.json()).resolves.toMatchObject({
			conversation: {
				id: conversationId,
				title: "Support thread",
			},
			pagination: {
				limit: 20,
				offset: 5,
				hasMore: false,
			},
		});
	});

	test("handler rejects chat requests without an external user ID", async () => {
		const proxy = portacall("sk_test_123", {
			baseURL: "https://example.com",
			fetch: async () => {
				throw new Error("fetch should not be called");
			},
		});

		const response = await proxy.handler(
			new Request("https://backend.example.com/api/portacall/agent_123/chat", {
				method: "POST",
				headers: {
					"content-type": "application/json; charset=utf-8",
				},
				body: JSON.stringify({
					message: "Hello from handler",
				}),
			}),
		);

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({
			message: "External user ID is required.",
		});
	});

	test("handler preserves upstream wrong-user conversation errors", async () => {
		const proxy = portacall("sk_test_123", {
			baseURL: "https://example.com",
			fetch: async () =>
				new Response(
					JSON.stringify({
						message: "Conversation not found.",
						code: "conversation_not_found",
					}),
					{
						status: 404,
						headers: { "content-type": "application/json; charset=utf-8" },
					},
				),
		});

		const response = await proxy.handler(
			new Request("https://backend.example.com/api/portacall/agent_123/chat", {
				method: "POST",
				headers: {
					"content-type": "application/json; charset=utf-8",
				},
				body: JSON.stringify({
					message: "Hello from handler",
					conversationId,
					externalUserId: "user_456",
				}),
			}),
		);

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toEqual({
			message: "Conversation not found.",
			code: "conversation_not_found",
			status: 404,
		});
	});

	test("handler proxies stream requests to the Portacall API", async () => {
		let receivedURL = "";
		let receivedInit: RequestInit | undefined;
		const encoder = new TextEncoder();

		const proxy = portacall("sk_test_123", {
			baseURL: "https://example.com",
			fetch: async (input, init) => {
				receivedURL = String(input);
				receivedInit = init;

				return new Response(
					new ReadableStream({
						start(controller) {
							controller.enqueue(
								encoder.encode(
									`event: conversation_id\ndata: ${JSON.stringify({
										type: "conversation_id",
										conversationId,
									})}\n\n`,
								),
							);
							controller.enqueue(
								encoder.encode(
									`event: text_delta\ndata: ${JSON.stringify({
										type: "text_delta",
										text: "Hello from stream",
									})}\n\n`,
								),
							);
							controller.close();
						},
					}),
					{
						status: 200,
						headers: {
							"content-type": "text/event-stream; charset=utf-8",
							"x-portacall-conversation-id": conversationId,
						},
					},
				);
			},
		});

		const response = await proxy.handler(
			new Request(
				"https://backend.example.com/api/portacall/agent_123/stream",
				{
					method: "POST",
					headers: {
						"content-type": "application/json; charset=utf-8",
					},
					body: JSON.stringify({
						message: "  Hello there  ",
						externalUserId: "  user_123  ",
					}),
				},
			),
		);

		expect(receivedURL).toBe(
			"https://example.com/api/portacall/agent_123/stream",
		);
		expect(receivedInit?.method).toBe("POST");
		expect(receivedInit?.headers).toEqual({
			accept: "text/event-stream",
			"content-type": "application/json; charset=utf-8",
			authorization: "Bearer sk_test_123",
		});
		expect(receivedInit?.body).toBe(
			JSON.stringify({
				message: "Hello there",
				externalUserId: "user_123",
			}),
		);
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe(
			"text/event-stream; charset=utf-8",
		);
		expect(response.headers.get("x-portacall-conversation-id")).toBe(
			conversationId,
		);
		await expect(response.text()).resolves.toContain(
			'"type":"text_delta","text":"Hello from stream"',
		);
	});

	test("handler renames, archives, and deletes conversations", async () => {
		const requests: Array<{ url: string; init?: RequestInit }> = [];

		const proxy = portacall("sk_test_123", {
			baseURL: "https://example.com",
			fetch: async (input, init) => {
				const url = String(input);
				requests.push({ url, init });

				if (url.endsWith("/archive")) {
					return new Response(
						JSON.stringify({
							conversation: {
								id: conversationId,
								title: "Renamed thread",
								createdAt: "2026-03-27T10:00:00.000Z",
								updatedAt: "2026-03-27T10:05:00.000Z",
								lastMessageAt: "2026-03-27T10:05:00.000Z",
								archivedAt: "2026-03-27T10:10:00.000Z",
							},
						}),
						{
							status: 200,
							headers: { "content-type": "application/json; charset=utf-8" },
						},
					);
				}

				if (init?.method === "DELETE") {
					return new Response(
						JSON.stringify({ id: conversationId, deleted: true }),
						{
							status: 200,
							headers: { "content-type": "application/json; charset=utf-8" },
						},
					);
				}

				return new Response(
					JSON.stringify({
						conversation: {
							id: conversationId,
							title: "Renamed thread",
							createdAt: "2026-03-27T10:00:00.000Z",
							updatedAt: "2026-03-27T10:05:00.000Z",
							lastMessageAt: "2026-03-27T10:05:00.000Z",
							archivedAt: null,
						},
					}),
					{
						status: 200,
						headers: { "content-type": "application/json; charset=utf-8" },
					},
				);
			},
		});

		await proxy.handler(
			new Request(
				`https://backend.example.com/api/portacall/agent_123/conversations/${conversationId}`,
				{
					method: "PATCH",
					headers: {
						"content-type": "application/json; charset=utf-8",
					},
					body: JSON.stringify({
						externalUserId: "user_123",
						title: "  Renamed thread  ",
					}),
				},
			),
		);

		await proxy.handler(
			new Request(
				`https://backend.example.com/api/portacall/agent_123/conversations/${conversationId}/archive`,
				{
					method: "PATCH",
					headers: {
						"content-type": "application/json; charset=utf-8",
					},
					body: JSON.stringify({
						externalUserId: "user_123",
						archived: true,
					}),
				},
			),
		);

		await proxy.handler(
			new Request(
				`https://backend.example.com/api/portacall/agent_123/conversations/${conversationId}?externalUserId=user_123`,
				{
					method: "DELETE",
				},
			),
		);

		expect(requests).toEqual([
			{
				url: `https://example.com/api/portacall/agent_123/conversations/${conversationId}`,
				init: {
					method: "PATCH",
					headers: {
						"content-type": "application/json; charset=utf-8",
						authorization: "Bearer sk_test_123",
					},
					body: JSON.stringify({
						externalUserId: "user_123",
						title: "Renamed thread",
					}),
				},
			},
			{
				url: `https://example.com/api/portacall/agent_123/conversations/${conversationId}/archive`,
				init: {
					method: "PATCH",
					headers: {
						"content-type": "application/json; charset=utf-8",
						authorization: "Bearer sk_test_123",
					},
					body: JSON.stringify({
						externalUserId: "user_123",
						archived: true,
					}),
				},
			},
			{
				url: `https://example.com/api/portacall/agent_123/conversations/${conversationId}?externalUserId=user_123`,
				init: {
					method: "DELETE",
					headers: {
						authorization: "Bearer sk_test_123",
					},
				},
			},
		]);
	});

	test("express adapter handles chat route", async () => {
		const proxy = portacall("sk_test_123", {
			baseURL: "https://example.com",
			fetch: async () =>
				new Response(
					JSON.stringify({
						content: "Handled by Express adapter",
						conversationId,
					}),
					{
						status: 200,
						headers: { "content-type": "application/json; charset=utf-8" },
					},
				),
		});

		const chunks: Uint8Array[] = [];
		let statusCode = 200;
		const headers = new Map<string, string | readonly string[]>();
		const response = {
			status(code: number) {
				statusCode = code;
				return response;
			},
			setHeader(name: string, value: string | readonly string[]) {
				headers.set(name, value);
				return response;
			},
			write(chunk: string | Uint8Array) {
				chunks.push(
					typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk,
				);
				return true;
			},
			end(chunk?: string | Uint8Array) {
				if (chunk) {
					response.write(chunk);
				}
				return response;
			},
		};

		await createPortacallExpress(proxy)(
			{
				method: "POST",
				originalUrl: "/api/portacall/agent_123/chat",
				headers: {
					host: "example.com",
					"content-type": "application/json; charset=utf-8",
				},
				body: {
					message: "Hello from express",
					externalUserId: "user_123",
				},
			},
			response,
		);

		const decoder = new TextDecoder();
		const body = chunks.map((chunk) => decoder.decode(chunk)).join("");

		expect(statusCode).toBe(200);
		expect(headers.get("content-type")).toBe("application/json; charset=utf-8");
		expect(JSON.parse(body)).toEqual({
			content: "Handled by Express adapter",
			conversationId,
		});
	});
});
