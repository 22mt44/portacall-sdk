import { describe, expect, test } from "bun:test";
import { portacall } from "./portacall";

describe("portacall", () => {
	test("chat sends a request and returns content", async () => {
		let receivedURL = "";
		let receivedInit: RequestInit | undefined;

		const agent = portacall({
			agentId: "agent_123",
			secretKey: "sk_test_123",
			baseURL: "https://example.com",
			fetch: async (input, init) => {
				receivedURL = String(input);
				receivedInit = init;

				return new Response(JSON.stringify({ content: "Hello from agent" }), {
					status: 200,
					headers: { "content-type": "application/json; charset=utf-8" },
				});
			},
		});

		const content = await agent.chat("  Hello there  ");

		expect(content).toBe("Hello from agent");
		expect(receivedURL).toBe("https://example.com/api/agent/agent_123/chat");
		expect(receivedInit?.method).toBe("POST");
		expect(receivedInit?.headers).toEqual({
			"content-type": "application/json; charset=utf-8",
			authorization: "Bearer sk_test_123",
		});
		expect(receivedInit?.body).toBe(JSON.stringify({ message: "Hello there" }));
	});

	test("chat rejects empty messages", async () => {
		const agent = portacall({
			agentId: "agent_123",
			secretKey: "sk_test_123",
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
			secretKey: "sk_test_123",
			fetch: async () =>
				new Response(
					JSON.stringify({
						message: "Invalid secret key",
						code: "invalid_secret_key",
					}),
					{
						status: 401,
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
				message: "Invalid secret key",
				status: 401,
				code: "invalid_secret_key",
			});
		}
	});

	test("handler returns health status", async () => {
		const agent = portacall({
			agentId: "",
			secretKey: "",
			fetch: async () =>
				new Response(JSON.stringify({ content: "unused" }), {
					status: 200,
					headers: { "content-type": "application/json; charset=utf-8" },
				}),
		});

		const response = await agent.handler(
			new Request("https://example.com/api/agent/health"),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			ok: true,
			configured: false,
		});
	});

	test("handler returns chat response", async () => {
		const agent = portacall({
			agentId: "agent_123",
			secretKey: "sk_test_123",
			baseURL: "https://example.com",
			fetch: async () =>
				new Response(JSON.stringify({ content: "Handled by SDK" }), {
					status: 200,
					headers: { "content-type": "application/json; charset=utf-8" },
				}),
		});

		const response = await agent.handler(
			new Request("https://example.com/api/agent/chat", {
				method: "POST",
				headers: {
					"content-type": "application/json; charset=utf-8",
				},
				body: JSON.stringify({ message: "Hello from handler" }),
			}),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			content: "Handled by SDK",
		});
	});

	test("stream sends a request and yields chunks", async () => {
		let receivedURL = "";
		let receivedInit: RequestInit | undefined;
		const encoder = new TextEncoder();

		const agent = portacall({
			agentId: "agent_123",
			secretKey: "sk_test_123",
			baseURL: "https://example.com",
			fetch: async (input, init) => {
				receivedURL = String(input);
				receivedInit = init;

				return new Response(
					new ReadableStream({
						start(controller) {
							controller.enqueue(encoder.encode("Hello "));
							controller.enqueue(encoder.encode("from "));
							controller.enqueue(encoder.encode("stream"));
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

		expect(chunks).toEqual(["Hello ", "from ", "stream"]);
		expect(receivedURL).toBe("https://example.com/api/agent/agent_123/stream");
		expect(receivedInit?.method).toBe("POST");
		expect(receivedInit?.headers).toEqual({
			"content-type": "application/json; charset=utf-8",
			authorization: "Bearer sk_test_123",
		});
		expect(receivedInit?.body).toBe(JSON.stringify({ message: "Hello there" }));
	});

	test("stream maps API errors to PortacallError", async () => {
		const agent = portacall({
			agentId: "agent_123",
			secretKey: "sk_test_123",
			fetch: async () =>
				new Response(
					JSON.stringify({
						message: "Streaming is unavailable",
						code: "stream_unavailable",
					}),
					{
						status: 503,
						headers: { "content-type": "application/json; charset=utf-8" },
					},
				),
		});

		try {
			for await (const _chunk of agent.stream("Hello")) {
			}
			throw new Error("Expected stream to throw.");
		} catch (error) {
			expect(error).toBeInstanceOf(Error);
			expect(error).toMatchObject({
				name: "PortacallError",
				message: "Streaming is unavailable",
				status: 503,
				code: "stream_unavailable",
			});
		}
	});

	test("hono adapter exposes health route", async () => {
		const agent = portacall({
			agentId: "agent_123",
			secretKey: "sk_test_123",
			fetch: async () =>
				new Response(JSON.stringify({ content: "unused" }), {
					status: 200,
					headers: { "content-type": "application/json; charset=utf-8" },
				}),
		});

		const response = await agent.hono().request("/health");

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			ok: true,
			configured: true,
		});
	});

	test("express adapter handles chat route", async () => {
		const agent = portacall({
			agentId: "agent_123",
			secretKey: "sk_test_123",
			baseURL: "https://example.com",
			fetch: async () =>
				new Response(
					JSON.stringify({ content: "Handled by Express adapter" }),
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

		await agent.express()(
			{
				method: "POST",
				originalUrl: "/api/agent/chat",
				headers: {
					host: "example.com",
					"content-type": "application/json; charset=utf-8",
				},
				body: { message: "Hello from express" },
			},
			response,
		);

		const decoder = new TextDecoder();
		const body = chunks.map((chunk) => decoder.decode(chunk)).join("");

		expect(statusCode).toBe(200);
		expect(headers.get("content-type")).toBe("application/json; charset=utf-8");
		expect(JSON.parse(body)).toEqual({
			content: "Handled by Express adapter",
		});
	});
});
