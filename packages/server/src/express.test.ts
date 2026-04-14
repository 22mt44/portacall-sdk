import { describe, expect, test } from "bun:test";
import { createPortacallExpress } from "./express";

describe("@portacall/server/express", () => {
	test("creates an express-compatible handler", () => {
		const handler = createPortacallExpress({
			handler: async () =>
				new Response(JSON.stringify({ ok: true }), {
					headers: { "content-type": "application/json; charset=utf-8" },
				}),
		});

		expect(typeof handler).toBe("function");
	});
});
