import { describe, expect, test } from "bun:test";
import { portacall } from "./index";

describe("portacall client", () => {
	test("health reads backend health status", async () => {
		let receivedURL = "";

		const agent = portacall({
			agentId: "agent_123",
			backendURL: "https://example.com",
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

		const agent = portacall({
			agentId: "agent_123",
			backendURL: "https://example.com",
			fetch: async (input, init) => {
				receivedURL = String(input);
				receivedInit = init;

				return new Response(JSON.stringify({ content: "Hello from client" }), {
					status: 200,
					headers: { "content-type": "application/json; charset=utf-8" },
				});
			},
		});

		const content = await agent.chat("  Hello there  ");

		expect(content).toBe("Hello from client");
		expect(receivedURL).toBe(
			"https://example.com/api/portacall/agent_123/chat",
		);
		expect(receivedInit?.method).toBe("POST");
		expect(receivedInit?.headers).toEqual({
			"content-type": "application/json; charset=utf-8",
		});
		expect(receivedInit?.body).toBe(JSON.stringify({ message: "Hello there" }));
	});

	test("chat rejects empty messages", async () => {
		const agent = portacall({
			agentId: "agent_123",
			fetch: async () =>
				new Response(JSON.stringify({ content: "unused" }), {
					status: 200,
					headers: { "content-type": "application/json; charset=utf-8" },
				}),
		});

		await expect(agent.chat("   ")).rejects.toThrow("Message is required.");
	});

	test("chat maps API errors to PortacallError", async () => {
		const agent = portacall({
			agentId: "agent_123",
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
			await agent.chat("Hello");
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

		const agent = portacall({
			agentId: "agent_123",
			backendURL: "https://example.com",
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
						headers: { "content-type": "text/plain; charset=utf-8" },
					},
				);
			},
		});

		const chunks: string[] = [];
		for await (const chunk of agent.stream("  Hello there  ")) {
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
		expect(receivedInit?.body).toBe(JSON.stringify({ message: "Hello there" }));
	});
});
