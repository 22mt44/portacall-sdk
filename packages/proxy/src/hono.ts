import { Hono } from "hono";

type PortacallRequestHandler = {
	handler(request: Request): Promise<Response>;
};

export function createPortacallHono(agent: PortacallRequestHandler): Hono {
	const app = new Hono();

	app.get("/:agentId/health", (c) => agent.handler(c.req.raw));
	app.post("/:agentId/chat", (c) => agent.handler(c.req.raw));
	app.post("/:agentId/stream", (c) => agent.handler(c.req.raw));

	return app;
}
