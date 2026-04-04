import { afterEach, describe, expect, test } from "bun:test";
import { useEffect } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import {
	type PortacallChatMessage,
	type PortacallClient,
	type PortacallClientHealth,
	type PortacallConversationSummary,
	PortacallProvider,
	type UsePortacallChatResult,
	type UsePortacallResult,
	usePortacall,
	usePortacallChat,
	usePortacallClient,
} from "./index";

const conversationId = "18e40f1f-490d-4ee9-9d31-c6da546dac66";

(
	globalThis as typeof globalThis & {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

describe("@portacall/react", () => {
	let renderer: ReactTestRenderer | null = null;

	afterEach(async () => {
		if (renderer) {
			await act(async () => {
				renderer?.unmount();
			});
			renderer = null;
		}
	});

	test("usePortacallClient resolves a provider client", async () => {
		const client = createMockClient();
		let receivedClient: PortacallClient | null = null;

		function ClientReader() {
			const value = usePortacallClient();

			useEffect(() => {
				receivedClient = value;
			}, [value]);

			return null;
		}

		await act(async () => {
			renderer = create(
				<PortacallProvider client={client}>
					<ClientReader />
				</PortacallProvider>,
			);
			await flush();
		});

		expect(receivedClient === client).toBe(true);
	});

	test("usePortacall combines client creation with chat state", async () => {
		let latestPortacall: UsePortacallResult | null = null;
		const requestedURLs: string[] = [];

		await act(async () => {
			renderer = create(
				<PortacallHarness
					capture={(value) => {
						latestPortacall = value;
					}}
					options={{
						backendURL: "https://example.com",
						agentId: "agent_123",
						externalUserId: "user_123",
						fetch: async (input) => {
							const url = String(input);
							requestedURLs.push(url);

							if (url.endsWith("/health")) {
								return new Response(
									JSON.stringify({
										ok: true,
										configured: true,
									}),
									{
										status: 200,
										headers: {
											"content-type": "application/json; charset=utf-8",
										},
									},
								);
							}

							if (url.includes("/conversations?")) {
								return new Response(
									JSON.stringify({
										conversations: [],
										pagination: createPagination(),
									}),
									{
										status: 200,
										headers: {
											"content-type": "application/json; charset=utf-8",
										},
									},
								);
							}

							throw new Error(`Unexpected request: ${url}`);
						},
					}}
				/>,
			);
			await flush();
		});

		expect(readPortacall(latestPortacall).client.baseURL).toBe(
			"https://example.com/api/portacall/agent_123",
		);
		expect(readPortacall(latestPortacall).configured).toBe(true);
		expect(readPortacall(latestPortacall).conversations).toEqual([]);
		expect(requestedURLs).toEqual([
			"https://example.com/api/portacall/agent_123/health",
			"https://example.com/api/portacall/agent_123/conversations?externalUserId=user_123&limit=50&offset=0&includeArchived=false",
		]);
	});

	test("usePortacallChat aggregates stream deltas and auto-titles a new conversation", async () => {
		const renameCalls: Array<{ conversationId: string; title: string }> = [];
		const latestConversation = createConversationSummary({
			id: conversationId,
			title: null,
		});
		const renamedConversation = createConversationSummary({
			id: conversationId,
			title: "Hello world",
		});
		let latestChat: UsePortacallChatResult | null = null;

		const client = createMockClient({
			createConversation: async () => latestConversation,
			getConversations: async () => ({
				conversations: [renamedConversation],
				pagination: createPagination(),
			}),
			renameConversation: async (
				nextConversationId,
				_externalUserId,
				title,
			) => {
				renameCalls.push({ conversationId: nextConversationId, title });
				return renamedConversation;
			},
			stream: async function* () {
				yield {
					type: "conversation_id",
					conversationId,
				};
				yield {
					type: "text_delta",
					text: "Hello ",
				};
				yield {
					type: "tool_call_started",
					toolCallId: "tool_123",
					toolName: "lookup_user",
					args: { userId: "user_123" },
				};
				yield {
					type: "text_delta",
					text: "world",
				};
				yield {
					type: "tool_call_completed",
					toolCallId: "tool_123",
					toolName: "lookup_user",
					args: { userId: "user_123" },
					status: "completed",
				};
				yield {
					type: "message_completed",
					conversationId,
				};
			},
		});

		await act(async () => {
			renderer = create(
				<ChatHarness
					autoTitle={(message) => message}
					capture={(value) => {
						latestChat = value;
					}}
					client={client}
					externalUserId="user_123"
				/>,
			);
			await flush();
		});

		await act(async () => {
			const accepted = await readChat(latestChat).sendMessage("Hello world");
			expect(accepted).toBe(true);
			await flush();
		});

		expect(renameCalls).toEqual([
			{
				conversationId,
				title: "Hello world",
			},
		]);
		expect(readChat(latestChat).selectedConversationId).toBe(conversationId);
		expect(readChat(latestChat).messages).toHaveLength(2);
		expect(readChat(latestChat).messages[0]).toMatchObject({
			role: "user",
			content: "Hello world",
		} satisfies Partial<PortacallChatMessage>);
		expect(readChat(latestChat).messages[1]).toMatchObject({
			role: "assistant",
			content: "Hello world",
			isStreaming: false,
		} satisfies Partial<PortacallChatMessage>);
		expect(readChat(latestChat).streamEvents).toEqual([
			"Started lookup_user",
			"Completed lookup_user (completed)",
		]);
		expect(readChat(latestChat).conversations[0]).toMatchObject({
			id: conversationId,
			title: "Hello world",
		});
	});

	test("usePortacallChat resets transcript state when externalUserId changes", async () => {
		const getConversationUsers: string[] = [];
		const resetCalls: string[] = [];
		let latestChat: UsePortacallChatResult | null = null;
		const conversation = createConversationSummary({
			id: conversationId,
			title: "Support thread",
		});

		const client = createMockClient({
			getConversationMessages: async (_nextConversationId, externalUserId) => ({
				conversation,
				messages: [
					{
						id: "message_1",
						role: "assistant",
						content: `Hello ${externalUserId}`,
						createdAt: "2026-03-27T10:02:00.000Z",
					},
				],
				pagination: createPagination(),
			}),
			getConversations: async (externalUserId) => {
				getConversationUsers.push(externalUserId);

				return {
					conversations: [conversation],
					pagination: createPagination(),
				};
			},
			resetConversation: () => {
				resetCalls.push("reset");
			},
		});

		await act(async () => {
			renderer = create(
				<ChatHarness
					capture={(value) => {
						latestChat = value;
					}}
					client={client}
					externalUserId="user_alpha"
				/>,
			);
			await flush();
		});

		const resetCountAfterMount = resetCalls.length;

		await act(async () => {
			await readChat(latestChat).loadConversation(conversationId);
			await flush();
		});

		expect(readChat(latestChat).selectedConversationId).toBe(conversationId);
		expect(readChat(latestChat).messages[0]).toMatchObject({
			content: "Hello user_alpha",
		});

		await act(async () => {
			renderer?.update(
				<ChatHarness
					capture={(value) => {
						latestChat = value;
					}}
					client={client}
					externalUserId="user_beta"
				/>,
			);
			await flush();
		});

		expect(resetCalls.length).toBe(resetCountAfterMount + 1);
		expect(getConversationUsers).toEqual(["user_alpha", "user_beta"]);
		expect(readChat(latestChat).selectedConversationId).toBeNull();
		expect(readChat(latestChat).messages).toEqual([]);
		expect(readChat(latestChat).streamEvents).toEqual([]);
	});
});

type ChatHarnessProps = {
	autoTitle?: (message: string) => string;
	capture: (value: UsePortacallChatResult) => void;
	client: PortacallClient;
	externalUserId: string;
};

function ChatHarness({
	autoTitle,
	capture,
	client,
	externalUserId,
}: ChatHarnessProps) {
	const chat = usePortacallChat({
		client,
		externalUserId,
		autoTitle,
	});

	useEffect(() => {
		capture(chat);
	}, [capture, chat]);

	return null;
}

type PortacallHarnessProps = {
	capture: (value: UsePortacallResult) => void;
	options: Parameters<typeof usePortacall>[0];
};

function PortacallHarness({ capture, options }: PortacallHarnessProps) {
	const value = usePortacall(options);

	useEffect(() => {
		capture(value);
	}, [capture, value]);

	return null;
}

function createMockClient(
	overrides: Partial<PortacallClient> = {},
): PortacallClient {
	let currentConversationId: string | null = null;

	return {
		agentId: "agent_123",
		backendURL: "https://example.com",
		baseURL: "https://example.com/api/portacall/agent_123",
		get conversationId() {
			return currentConversationId;
		},
		resetConversation() {
			currentConversationId = null;
			overrides.resetConversation?.();
		},
		async health() {
			return (
				(await overrides.health?.()) ??
				({
					ok: true,
					configured: true,
				} satisfies PortacallClientHealth)
			);
		},
		async createConversation(externalUserId, options) {
			const conversation =
				(await overrides.createConversation?.(externalUserId, options)) ??
				createConversationSummary({
					id: conversationId,
					title: options?.title ?? null,
				});
			currentConversationId = conversation.id;
			return conversation;
		},
		async getConversations(externalUserId, options) {
			return (
				(await overrides.getConversations?.(externalUserId, options)) ?? {
					conversations: [],
					pagination: createPagination(options?.limit),
				}
			);
		},
		async getConversationMessages(conversationId, externalUserId, options) {
			return (
				(await overrides.getConversationMessages?.(
					conversationId,
					externalUserId,
					options,
				)) ?? {
					conversation: createConversationSummary({
						id: conversationId,
						title: "Support thread",
					}),
					messages: [],
					pagination: createPagination(options?.limit),
				}
			);
		},
		async renameConversation(conversationId, externalUserId, title) {
			return (
				(await overrides.renameConversation?.(
					conversationId,
					externalUserId,
					title,
				)) ??
				createConversationSummary({
					id: conversationId,
					title,
				})
			);
		},
		async archiveConversation(conversationId, externalUserId) {
			return (
				(await overrides.archiveConversation?.(
					conversationId,
					externalUserId,
				)) ??
				createConversationSummary({
					id: conversationId,
					title: "Archived",
					archivedAt: "2026-03-27T10:03:00.000Z",
				})
			);
		},
		async unarchiveConversation(conversationId, externalUserId) {
			return (
				(await overrides.unarchiveConversation?.(
					conversationId,
					externalUserId,
				)) ??
				createConversationSummary({
					id: conversationId,
					title: "Restored",
				})
			);
		},
		async deleteConversation(conversationId, externalUserId) {
			await overrides.deleteConversation?.(conversationId, externalUserId);
		},
		async chat(message, options) {
			return (
				(await overrides.chat?.(message, options)) ?? {
					content: "",
					conversationId,
					events: [],
				}
			);
		},
		async *stream(message, options) {
			if (overrides.stream) {
				for await (const event of overrides.stream(message, options)) {
					if (event.type === "conversation_id") {
						currentConversationId = event.conversationId;
					}
					yield event;
				}
				return;
			}

			yield {
				type: "conversation_id",
				conversationId,
			} as const;
			yield {
				type: "message_completed",
				conversationId,
			} as const;
		},
	};
}

function createConversationSummary(
	overrides: Partial<PortacallConversationSummary>,
): PortacallConversationSummary {
	return {
		id: overrides.id ?? conversationId,
		title: overrides.title ?? null,
		createdAt: overrides.createdAt ?? "2026-03-27T10:00:00.000Z",
		updatedAt: overrides.updatedAt ?? "2026-03-27T10:05:00.000Z",
		lastMessageAt: overrides.lastMessageAt ?? "2026-03-27T10:05:00.000Z",
		archivedAt: overrides.archivedAt ?? null,
	};
}

function createPagination(limit = 50) {
	return {
		limit,
		offset: 0,
		hasMore: false,
	};
}

async function flush() {
	await Promise.resolve();
	await Promise.resolve();
}

function readChat(
	value: UsePortacallChatResult | null,
): UsePortacallChatResult {
	if (!value) {
		throw new Error("Expected hook state to be available.");
	}

	return value;
}

function readPortacall(value: UsePortacallResult | null): UsePortacallResult {
	if (!value) {
		throw new Error("Expected hook state to be available.");
	}

	return value;
}
