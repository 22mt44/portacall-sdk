import { describe, expect, test } from "bun:test";
import { createPortacallExpress } from "./express";
import { createPortacallHono } from "./hono";
import { portacall } from "./portacall";

describe("portacall proxy", () => {
	test("handler returns health status", async () => {
		const agent = portacall({
			agentId: "agent_123",
			secretKey: "",
			fetch: async () =>
				new Response(JSON.stringify({ content: "unused" }), {
					status: 200,
					headers: { "content-type": "application/json; charset=utf-8" },
				}),
		});

		const response = await agent.handler(
			new Request("https://example.com/api/agent/agent_123/health"),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			ok: true,
			configured: false,
		});
	});

	test("handler returns not found for a different agent id", async () => {
		const agent = portacall({
			agentId: "agent_123",
			secretKey: "sk_test_123",
			fetch: async () =>
				new Response(JSON.stringify({ content: "unused" }), {
					status: 200,
					headers: { "content-type": "application/json; charset=utf-8" },
				}),
		});

		const response = await agent.handler(
			new Request("https://example.com/api/agent/agent_999/health"),
		);

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toEqual({
			message: "Not found.",
		});
	});

	test("handler proxies chat requests to the Portacall API", async () => {
		let receivedURL = "";
		let receivedInit: RequestInit | undefined;

		const agent = portacall({
			agentId: "agent_123",
			secretKey: "sk_test_123",
			baseURL: "https://example.com",
			fetch: async (input, init) => {
				receivedURL = String(input);
				receivedInit = init;

				return new Response(JSON.stringify({ content: "Handled by SDK" }), {
					status: 200,
					headers: { "content-type": "application/json; charset=utf-8" },
				});
			},
		});

		const response = await agent.handler(
			new Request("https://backend.example.com/api/agent/agent_123/chat", {
				method: "POST",
				headers: {
					"content-type": "application/json; charset=utf-8",
				},
				body: JSON.stringify({ message: "Hello from handler" }),
			}),
		);

		expect(receivedURL).toBe("https://example.com/api/agent/agent_123/chat");
		expect(receivedInit?.method).toBe("POST");
		expect(receivedInit?.headers).toEqual({
			"content-type": "application/json; charset=utf-8",
			authorization: "Bearer sk_test_123",
		});
		expect(receivedInit?.body).toBe(
			JSON.stringify({ message: "Hello from handler" }),
		);
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			content: "Handled by SDK",
		});
	});

	test("handler proxies stream requests to the Portacall API", async () => {
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

		const response = await agent.handler(
			new Request("https://backend.example.com/api/agent/agent_123/stream", {
				method: "POST",
				headers: {
					"content-type": "application/json; charset=utf-8",
				},
				body: JSON.stringify({ message: "  Hello there  " }),
			}),
		);

		expect(receivedURL).toBe("https://example.com/api/agent/agent_123/stream");
		expect(receivedInit?.method).toBe("POST");
		expect(receivedInit?.headers).toEqual({
			"content-type": "application/json; charset=utf-8",
			authorization: "Bearer sk_test_123",
		});
		expect(receivedInit?.body).toBe(JSON.stringify({ message: "Hello there" }));
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe(
			"text/plain; charset=utf-8",
		);
		expect(await response.text()).toBe("Hello from stream");
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

		const response =
			await createPortacallHono(agent).request("/agent_123/health");

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

		await createPortacallExpress(agent)(
			{
				method: "POST",
				originalUrl: "/api/agent/agent_123/chat",
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
