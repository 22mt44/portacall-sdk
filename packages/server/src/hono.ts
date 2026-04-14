type PortacallToolDefinition = {
	id?: string;
	name: string;
	description: string;
	requiresConfirmation?: boolean;
	completionMode?: "accept_immediately" | "wait_for_result";
	requiresAuth?: boolean;
};

type HonoContextLike = {
	req: {
		raw: Request;
		param(name: string): string | undefined;
	};
	json(payload: unknown, status?: number): Response;
};

type PortacallToolWebhookEvent = {
	toolRunId: string;
	agentId: string;
	tool: {
		name: string;
		description: string;
	};
	args: {
		payload?: Record<string, unknown>;
		[key: string]: unknown;
	};
	meta: {
		requestId: string;
	};
};

type PortacallToolWebhookResponse =
	| {
			status: "accepted" | "completed";
			message?: string;
			output?: unknown;
	  }
	| {
			status: "failed";
			message?: string;
			error: {
				message: string;
				code?: string;
			};
	  };

type PortacallToolRunCompleteResponse = {
	toolRun: unknown;
	event: unknown;
	conversation: unknown;
	assistantMessage?: unknown;
};

type PortacallAgent<TAuth = unknown> = {
	id: string;
	handler(request: Request): Promise<Response>;
	webhook(request: Request): Promise<Response>;
	completeToolRun(
		toolRunId: string,
		body: {
			status: "completed" | "failed";
			message?: string;
			errorCode?: string;
			output?: unknown;
		},
	): Promise<PortacallToolRunCompleteResponse>;
	syncTools(): Promise<{ tools: unknown[] }>;
	registerTool(
		definition: PortacallToolDefinition,
		handler: (input: {
			event: PortacallToolWebhookEvent;
			payload: Record<string, unknown>;
			auth: TAuth | null;
			completeToolRun: PortacallAgent<TAuth>["completeToolRun"];
		}) => Promise<PortacallToolWebhookResponse> | PortacallToolWebhookResponse,
	): {
		id: string;
		name: string;
		description: string;
		requiresConfirmation: boolean;
		completionMode: "accept_immediately" | "wait_for_result";
		requiresAuth: boolean;
	};
	getRegisteredTools(): Array<{
		id: string;
		name: string;
		description: string;
		requiresConfirmation: boolean;
		completionMode: "accept_immediately" | "wait_for_result";
		requiresAuth: boolean;
	}>;
};

export type PortacallHonoToolRouteConfig<TInput, TResult, TAuth = unknown> = {
	tool: PortacallToolDefinition;
	fromHttp: (context: HonoContextLike) => TInput | Promise<TInput>;
	fromTool: (
		payload: Record<string, unknown>,
		event: PortacallToolWebhookEvent,
	) => TInput | Promise<TInput>;
	getHttpAuth?: (
		context: HonoContextLike,
	) => TAuth | null | Promise<TAuth | null>;
	execute: (input: {
		source: "http" | "tool";
		input: TInput;
		auth: TAuth | null;
		context?: HonoContextLike;
		event?: PortacallToolWebhookEvent;
		completeToolRun: PortacallAgent<TAuth>["completeToolRun"];
	}) => TResult | Promise<TResult>;
	toHttpResponse?: (input: {
		context: HonoContextLike;
		result: TResult;
	}) => Response | Promise<Response>;
	toToolResponse?: (input: {
		event: PortacallToolWebhookEvent;
		result: TResult;
	}) => PortacallToolWebhookResponse | Promise<PortacallToolWebhookResponse>;
};

export function createPortacallHono<TAuth = unknown>(
	agent: PortacallAgent<TAuth>,
) {
	return {
		handler(context: Pick<HonoContextLike, "req">): Promise<Response> {
			return agent.handler(context.req.raw);
		},
		webhook(context: Pick<HonoContextLike, "req">): Promise<Response> {
			return agent.webhook(context.req.raw);
		},
		toolRoute<TInput, TResult>(
			config: PortacallHonoToolRouteConfig<TInput, TResult, TAuth>,
		): (context: HonoContextLike) => Promise<Response> {
			agent.registerTool(config.tool, async ({ event, payload, auth }) => {
				const input = await config.fromTool(payload, event);
				const result = await config.execute({
					source: "tool",
					input,
					auth,
					event,
					completeToolRun: agent.completeToolRun,
				});
				if (config.toToolResponse) {
					return config.toToolResponse({ event, result });
				}

				return {
					status: "completed",
					output: result,
				};
			});

			return async (context) => {
				const input = await config.fromHttp(context);
				const auth = config.getHttpAuth
					? await config.getHttpAuth(context)
					: null;
				const result = await config.execute({
					source: "http",
					input,
					auth,
					context,
					completeToolRun: agent.completeToolRun,
				});
				if (config.toHttpResponse) {
					return config.toHttpResponse({ context, result });
				}

				return context.json(result);
			};
		},
	};
}
