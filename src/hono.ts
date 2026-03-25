import { Hono } from "hono";

type PortacallRequestHandler = {
	handler(request: Request): Promise<Response>;
};

export function createPortacallHono(agent: PortacallRequestHandler): Hono {
	const app = new Hono();

	app.get("/health", (c) => agent.handler(c.req.raw));
	app.post("/chat", (c) => agent.handler(c.req.raw));
	app.post("/stream", (c) => agent.handler(c.req.raw));

	return app;
}
