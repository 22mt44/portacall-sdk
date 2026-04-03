import { describe, expect, test } from "bun:test";
import { portacall } from "./index";

const conversationId = "18e40f1f-490d-4ee9-9d31-c6da546dac66";

describe("portacall client", () => {
	test("health reads backend health status", async () => {
		let receivedURL = "";

		const agent = portacall("https://example.com", "agent_123", {
			fetch: async (input) => {
				receivedURL = String(input);

				return new Response(JSON.stringify({ ok: true, configured: true }), {
					status: 200,
					headers: { "content-type": "application/json; charset=utf-8" },
				});
			},
		});

		await expect(agent.health()).resolves.toEqual({
			ok: true,
			configured: true,
		});
		expect(agent.baseURL).toBe("https://example.com/api/portacall/agent_123");
		expect(receivedURL).toBe(
			"https://example.com/api/portacall/agent_123/health",
		);
	});

	test("createConversation creates a titled conversation and stores the ID", async () => {
		let receivedURL = "";
		let receivedInit: RequestInit | undefined;

		const agent = portacall("https://example.com", "agent_123", {
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

		await expect(
			agent.createConversation("  user_123  ", {
				title: "  Support thread  ",
			}),
		).resolves.toEqual({
			id: conversationId,
			title: "Support thread",
			createdAt: "2026-03-27T10:00:00.000Z",
			updatedAt: "2026-03-27T10:05:00.000Z",
			lastMessageAt: "2026-03-27T10:05:00.000Z",
			archivedAt: null,
		});
		expect(agent.conversationId).toBe(conversationId);
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
	});

	test("chat sends a request and returns content", async () => {
		let receivedURL = "";
		let receivedInit: RequestInit | undefined;

		const agent = portacall("https://example.com", "agent_123", {
			fetch: async (input, init) => {
				receivedURL = String(input);
				receivedInit = init;

				return new Response(
					JSON.stringify({
						content: "Hello from client",
						conversationId,
						events: [
							{
								type: "conversation_id",
								conversationId,
							},
							{
								type: "text_delta",
								text: "Hello from client",
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

		const result = await agent.chat("  Hello there  ", {
			externalUserId: "  user_123  ",
		});

		expect(result).toEqual({
			content: "Hello from client",
			conversationId,
			events: [
				{
					type: "conversation_id",
					conversationId,
				},
				{
					type: "text_delta",
					text: "Hello from client",
				},
				{
					type: "message_completed",
					conversationId,
				},
			],
		});
		expect(receivedURL).toBe(
			"https://example.com/api/portacall/agent_123/chat",
		);
		expect(receivedInit?.method).toBe("POST");
		expect(receivedInit?.headers).toEqual({
			"content-type": "application/json; charset=utf-8",
		});
		expect(receivedInit?.body).toBe(
			JSON.stringify({
				message: "Hello there",
				externalUserId: "user_123",
			}),
		);
	});

	test("chat trims and forwards externalUserId", async () => {
		let receivedInit: RequestInit | undefined;

		const agent = portacall("https://example.com", "agent_123", {
			fetch: async (_, init) => {
				receivedInit = init;

				return new Response(
					JSON.stringify({
						content: "Hello from client",
						conversationId,
					}),
					{
						status: 200,
						headers: { "content-type": "application/json; charset=utf-8" },
					},
				);
			},
		});

		await agent.chat("Hello there", {
			externalUserId: "  user_123  ",
		});

		expect(receivedInit?.body).toBe(
			JSON.stringify({
				message: "Hello there",
				externalUserId: "user_123",
			}),
		);
	});

	test("chat rejects an empty external user ID", async () => {
		const agent = portacall("", "agent_123", {
			fetch: async () =>
				new Response(JSON.stringify({ content: "unused" }), {
					status: 200,
					headers: { "content-type": "application/json; charset=utf-8" },
				}),
		});

		await expect(
			agent.chat("Hello", {
				externalUserId: "   ",
			}),
		).rejects.toThrow("External user ID is required.");
	});

	test("chat rejects empty messages", async () => {
		const agent = portacall("", "agent_123", {
			fetch: async () =>
				new Response(JSON.stringify({ content: "unused" }), {
					status: 200,
					headers: { "content-type": "application/json; charset=utf-8" },
				}),
		});

		await expect(
			agent.chat("   ", {
				externalUserId: "user_123",
			}),
		).rejects.toThrow("Message is required.");
	});

	test("chat maps API errors to PortacallError", async () => {
		const agent = portacall("", "agent_123", {
			fetch: async () =>
				new Response(
					JSON.stringify({
						message: "Chat is unavailable",
						code: "chat_unavailable",
					}),
					{
						status: 503,
						headers: { "content-type": "application/json; charset=utf-8" },
					},
				),
		});

		try {
			await agent.chat("Hello", {
				externalUserId: "user_123",
			});
			throw new Error("Expected chat to throw.");
		} catch (error) {
			expect(error).toBeInstanceOf(Error);
			expect(error).toMatchObject({
				name: "PortacallError",
				message: "Chat is unavailable",
				status: 503,
				code: "chat_unavailable",
			});
		}
	});

	test("stream sends a request and yields structured events", async () => {
		let receivedURL = "";
		let receivedInit: RequestInit | undefined;
		const encoder = new TextEncoder();

		const agent = portacall("https://example.com", "agent_123", {
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
										text: "Hello ",
									})}\n\n`,
								),
							);
							controller.enqueue(
								encoder.encode(
									`event: tool_call_started\ndata: ${JSON.stringify({
										type: "tool_call_started",
										toolCallId: "call_123",
										toolName: "send_email",
										args: { subject: "Welcome" },
									})}\n\n`,
								),
							);
							controller.enqueue(
								encoder.encode(
									`event: text_delta\ndata: ${JSON.stringify({
										type: "text_delta",
										text: "from client",
									})}\n\n`,
								),
							);
							controller.enqueue(
								encoder.encode(
									`event: message_completed\ndata: ${JSON.stringify({
										type: "message_completed",
										conversationId,
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

		const events = [];
		for await (const event of agent.stream("  Hello there  ", {
			externalUserId: "  user_123  ",
		})) {
			events.push(event);
		}

		expect(events).toEqual([
			{
				type: "conversation_id",
				conversationId,
			},
			{
				type: "text_delta",
				text: "Hello ",
			},
			{
				type: "tool_call_started",
				toolCallId: "call_123",
				toolName: "send_email",
				args: { subject: "Welcome" },
			},
			{
				type: "text_delta",
				text: "from client",
			},
			{
				type: "message_completed",
				conversationId,
			},
		]);
		expect(receivedURL).toBe(
			"https://example.com/api/portacall/agent_123/stream",
		);
		expect(receivedInit?.method).toBe("POST");
		expect(receivedInit?.headers).toEqual({
			accept: "text/event-stream",
			"content-type": "application/json; charset=utf-8",
		});
		expect(receivedInit?.body).toBe(
			JSON.stringify({
				message: "Hello there",
				externalUserId: "user_123",
			}),
		);
		expect(agent.conversationId).toBe(conversationId);
	});

	test("getConversations requests paginated user-scoped conversation summaries", async () => {
		let receivedURL = "";
		let receivedInit: RequestInit | undefined;

		const agent = portacall("https://example.com", "agent_123", {
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

		await expect(
			agent.getConversations("  user_123  ", {
				limit: 25,
				offset: 10,
				includeArchived: true,
			}),
		).resolves.toEqual({
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
		expect(receivedURL).toBe(
			"https://example.com/api/portacall/agent_123/conversations?externalUserId=user_123&limit=25&offset=10&includeArchived=true",
		);
		expect(receivedInit?.method).toBe("GET");
	});

	test("getConversationMessages loads one conversation and stores the ID", async () => {
		let receivedURL = "";

		const agent = portacall("https://example.com", "agent_123", {
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
							offset: 0,
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

		await expect(
			agent.getConversationMessages(conversationId, "user_123", {
				limit: 20,
			}),
		).resolves.toEqual({
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
				offset: 0,
				hasMore: false,
			},
		});
		expect(receivedURL).toBe(
			`https://example.com/api/portacall/agent_123/conversations/${conversationId}/messages?externalUserId=user_123&limit=20`,
		);
		expect(agent.conversationId).toBe(conversationId);
	});

	test("renameConversation renames a conversation", async () => {
		let receivedInit: RequestInit | undefined;

		const agent = portacall("https://example.com", "agent_123", {
			fetch: async (_, init) => {
				receivedInit = init;

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

		await expect(
			agent.renameConversation(
				conversationId,
				"user_123",
				"  Renamed thread  ",
			),
		).resolves.toEqual({
			id: conversationId,
			title: "Renamed thread",
			createdAt: "2026-03-27T10:00:00.000Z",
			updatedAt: "2026-03-27T10:05:00.000Z",
			lastMessageAt: "2026-03-27T10:05:00.000Z",
			archivedAt: null,
		});
		expect(receivedInit?.method).toBe("PATCH");
		expect(receivedInit?.body).toBe(
			JSON.stringify({
				externalUserId: "user_123",
				title: "Renamed thread",
			}),
		);
	});

	test("archiveConversation and unarchiveConversation toggle archive state", async () => {
		const bodies: string[] = [];
		let archived = true;

		const agent = portacall("https://example.com", "agent_123", {
			fetch: async (_, init) => {
				bodies.push(String(init?.body ?? ""));

				return new Response(
					JSON.stringify({
						conversation: {
							id: conversationId,
							title: "Support thread",
							createdAt: "2026-03-27T10:00:00.000Z",
							updatedAt: "2026-03-27T10:05:00.000Z",
							lastMessageAt: "2026-03-27T10:05:00.000Z",
							archivedAt: archived ? "2026-03-27T10:10:00.000Z" : null,
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
			agent.archiveConversation(conversationId, "user_123"),
		).resolves.toMatchObject({
			id: conversationId,
			archivedAt: "2026-03-27T10:10:00.000Z",
		});

		archived = false;

		await expect(
			agent.unarchiveConversation(conversationId, "user_123"),
		).resolves.toMatchObject({
			id: conversationId,
			archivedAt: null,
		});

		expect(bodies).toEqual([
			JSON.stringify({
				externalUserId: "user_123",
				archived: true,
			}),
			JSON.stringify({
				externalUserId: "user_123",
				archived: false,
			}),
		]);
	});

	test("deleteConversation deletes the active conversation and resets state", async () => {
		let receivedURL = "";

		const agent = portacall("https://example.com", "agent_123", {
			fetch: async (input, init) => {
				receivedURL = String(input);

				if (init?.method === "DELETE") {
					return new Response(JSON.stringify({ deleted: true }), {
						status: 200,
						headers: { "content-type": "application/json; charset=utf-8" },
					});
				}

				return new Response(
					JSON.stringify({
						conversation: {
							id: conversationId,
							title: null,
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

		await agent.createConversation("user_123");
		await agent.deleteConversation(conversationId, "user_123");

		expect(receivedURL).toBe(
			`https://example.com/api/portacall/agent_123/conversations/${conversationId}?externalUserId=user_123`,
		);
		expect(agent.conversationId).toBeNull();
	});

	test("getConversations rejects an empty external user ID", async () => {
		const agent = portacall("https://example.com", "agent_123", {
			fetch: async () =>
				new Response(JSON.stringify({ conversations: [] }), {
					status: 200,
					headers: { "content-type": "application/json; charset=utf-8" },
				}),
		});

		await expect(agent.getConversations("   ")).rejects.toThrow(
			"External user ID is required.",
		);
	});

	test("multiple agent instances can coexist", () => {
		const supportAgent = portacall("https://example.com", "support-agent");
		const salesAgent = portacall("https://example.com", "sales-agent");

		expect(supportAgent.baseURL).toBe(
			"https://example.com/api/portacall/support-agent",
		);
		expect(salesAgent.baseURL).toBe(
			"https://example.com/api/portacall/sales-agent",
		);
	});
});
