import { describe, expect, test } from "bun:test";
import { portacall } from "./index";

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
						conversationId: "18e40f1f-490d-4ee9-9d31-c6da546dac66",
					}),
					{
						status: 200,
						headers: { "content-type": "application/json; charset=utf-8" },
					},
				);
			},
		});

		const content = await agent.chat("  Hello there  ", {
			externalUserId: "  user_123  ",
		});

		expect(content).toBe("Hello from client");
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
						conversationId: "18e40f1f-490d-4ee9-9d31-c6da546dac66",
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

	test("stream sends a request and yields chunks", async () => {
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
							controller.enqueue(encoder.encode("Hello "));
							controller.enqueue(encoder.encode("from "));
							controller.enqueue(encoder.encode("client"));
							controller.close();
						},
					}),
					{
						status: 200,
						headers: {
							"content-type": "text/plain; charset=utf-8",
							"x-portacall-conversation-id":
								"18e40f1f-490d-4ee9-9d31-c6da546dac66",
						},
					},
				);
			},
		});

		const chunks: string[] = [];
		for await (const chunk of agent.stream("  Hello there  ", {
			externalUserId: "  user_123  ",
		})) {
			chunks.push(chunk);
		}

		expect(chunks).toEqual(["Hello ", "from ", "client"]);
		expect(receivedURL).toBe(
			"https://example.com/api/portacall/agent_123/stream",
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

	test("getConversations requests user-scoped conversation summaries", async () => {
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
								id: "18e40f1f-490d-4ee9-9d31-c6da546dac66",
								createdAt: "2026-03-27T10:00:00.000Z",
								updatedAt: "2026-03-27T10:05:00.000Z",
								lastMessageAt: "2026-03-27T10:05:00.000Z",
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

		await expect(agent.getConversations("  user_123  ")).resolves.toEqual([
			{
				id: "18e40f1f-490d-4ee9-9d31-c6da546dac66",
				createdAt: "2026-03-27T10:00:00.000Z",
				updatedAt: "2026-03-27T10:05:00.000Z",
				lastMessageAt: "2026-03-27T10:05:00.000Z",
			},
		]);
		expect(receivedURL).toBe(
			"https://example.com/api/portacall/agent_123/conversations?externalUserId=user_123",
		);
		expect(receivedInit?.method).toBe("GET");
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
