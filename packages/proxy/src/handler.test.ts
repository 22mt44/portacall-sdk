import { describe, expect, test } from "bun:test";
import { handlePortacallRequest } from "./handler";

describe("handlePortacallRequest", () => {
	test("forwards approve tool-run requests", async () => {
		const calls: Array<{
			agentId: string;
			toolRunId: string;
			externalUserId: string;
		}> = [];

		const response = await handlePortacallRequest(
			createMockPortacall({
				approveToolRun: async (agentId, toolRunId, externalUserId) => {
					calls.push({ agentId, toolRunId, externalUserId });
					return {
						toolRun: {
							id: toolRunId,
							conversationId: "conversation_123",
							agentId,
							externalUserId,
							toolCallId: "tool_123",
							toolName: "cancel order",
							summary: "Cancel order",
							payload: { orderId: "34567" },
							payloadJson: '{"orderId":"34567"}',
							status: "completed",
							decision: "approved",
							message: null,
							errorCode: null,
							output: null,
							createdAt: "2026-04-03T10:00:00.000Z",
							updatedAt: "2026-04-03T10:01:00.000Z",
							resolvedAt: "2026-04-03T10:01:00.000Z",
						},
						event: {
							type: "approval_resolved" as const,
							decision: "approved" as const,
							toolRun: {
								id: toolRunId,
								conversationId: "conversation_123",
								agentId,
								externalUserId,
								toolCallId: "tool_123",
								toolName: "cancel order",
								summary: "Cancel order",
								payload: { orderId: "34567" },
								payloadJson: '{"orderId":"34567"}',
								status: "completed" as const,
								decision: "approved" as const,
								message: null,
								errorCode: null,
								output: null,
								createdAt: "2026-04-03T10:00:00.000Z",
								updatedAt: "2026-04-03T10:01:00.000Z",
								resolvedAt: "2026-04-03T10:01:00.000Z",
							},
						},
						conversation: {
							id: "conversation_123",
							title: "Support",
							createdAt: "2026-04-03T10:00:00.000Z",
							updatedAt: "2026-04-03T10:01:00.000Z",
							lastMessageAt: "2026-04-03T10:01:00.000Z",
							archivedAt: null,
						},
					};
				},
			}),
			new Request(
				"https://example.com/api/portacall/agent_123/tool-runs/tool_run_123/approve",
				{
					method: "POST",
					headers: {
						"content-type": "application/json; charset=utf-8",
					},
					body: JSON.stringify({
						externalUserId: "user_123",
					}),
				},
			),
		);

		expect(response.status).toBe(200);
		expect(calls).toEqual([
			{
				agentId: "agent_123",
				toolRunId: "tool_run_123",
				externalUserId: "user_123",
			},
		]);
	});

	test("forwards async tool-run completion requests", async () => {
		const calls: Array<{
			agentId: string;
			toolRunId: string;
			body: {
				status: "completed" | "failed";
				message?: string;
				errorCode?: string;
				output?: unknown;
			};
		}> = [];

		const response = await handlePortacallRequest(
			createMockPortacall({
				completeToolRun: async (agentId, toolRunId, body) => {
					calls.push({ agentId, toolRunId, body });
					return {
						toolRun: {
							id: toolRunId,
							conversationId: "conversation_123",
							agentId,
							externalUserId: "user_123",
							toolCallId: "tool_123",
							toolName: "cancel order",
							summary: "Cancel order",
							payload: { orderId: "34567" },
							payloadJson: '{"orderId":"34567"}',
							status: body.status,
							decision: "approved",
							message: body.message ?? null,
							errorCode: body.errorCode ?? null,
							output: body.output ?? null,
							createdAt: "2026-04-03T10:00:00.000Z",
							updatedAt: "2026-04-03T10:02:00.000Z",
							resolvedAt: "2026-04-03T10:02:00.000Z",
						},
						event: {
							type: "tool_completed" as const,
							toolRun: {
								id: toolRunId,
								conversationId: "conversation_123",
								agentId,
								externalUserId: "user_123",
								toolCallId: "tool_123",
								toolName: "cancel order",
								summary: "Cancel order",
								payload: { orderId: "34567" },
								payloadJson: '{"orderId":"34567"}',
								status: body.status,
								decision: "approved",
								message: body.message ?? null,
								errorCode: body.errorCode ?? null,
								output: body.output ?? null,
								createdAt: "2026-04-03T10:00:00.000Z",
								updatedAt: "2026-04-03T10:02:00.000Z",
								resolvedAt: "2026-04-03T10:02:00.000Z",
							},
						},
						conversation: {
							id: "conversation_123",
							title: "Support",
							createdAt: "2026-04-03T10:00:00.000Z",
							updatedAt: "2026-04-03T10:02:00.000Z",
							lastMessageAt: "2026-04-03T10:02:00.000Z",
							archivedAt: null,
						},
					};
				},
			}),
			new Request(
				"https://example.com/api/portacall/agent_123/tool-runs/tool_run_123/complete",
				{
					method: "POST",
					headers: {
						"content-type": "application/json; charset=utf-8",
					},
					body: JSON.stringify({
						status: "completed",
						message: "Order canceled.",
						output: { orderId: "34567", canceled: true },
					}),
				},
			),
		);

		expect(response.status).toBe(200);
		expect(calls).toEqual([
			{
				agentId: "agent_123",
				toolRunId: "tool_run_123",
				body: {
					status: "completed",
					message: "Order canceled.",
					output: { orderId: "34567", canceled: true },
				},
			},
		]);
	});

	test("lists tool runs for a conversation", async () => {
		const response = await handlePortacallRequest(
			createMockPortacall({
				getToolRuns: async (
					agentId,
					conversationId,
					externalUserId,
					options,
				) => ({
					toolRuns: [
						{
							id: "tool_run_123",
							conversationId,
							agentId,
							externalUserId,
							toolCallId: "tool_123",
							toolName: "cancel order",
							summary: "Cancel order",
							payload: { orderId: "34567" },
							payloadJson: '{"orderId":"34567"}',
							status: options?.status === "pending" ? "pending" : "completed",
							decision: "pending",
							message: null,
							errorCode: null,
							output: null,
							createdAt: "2026-04-03T10:00:00.000Z",
							updatedAt: "2026-04-03T10:00:00.000Z",
							resolvedAt: null,
						},
					],
				}),
			}),
			new Request(
				"https://example.com/api/portacall/agent_123/conversations/conversation_123/tool-runs?externalUserId=user_123&status=pending",
			),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			toolRuns: [
				expect.objectContaining({
					id: "tool_run_123",
					status: "pending",
				}),
			],
		});
	});
});

function createMockPortacall(
	overrides: Partial<Parameters<typeof handlePortacallRequest>[0]> = {},
): Parameters<typeof handlePortacallRequest>[0] {
	return {
		configured: true,
		chat: async () => ({
			content: "ok",
			conversationId: "conversation_123",
		}),
		createConversation: async () => ({
			id: "conversation_123",
			title: null,
			createdAt: "2026-04-03T10:00:00.000Z",
			updatedAt: "2026-04-03T10:00:00.000Z",
			lastMessageAt: "2026-04-03T10:00:00.000Z",
			archivedAt: null,
		}),
		deleteConversation: async () => {},
		getConversationMessages: async () => ({
			conversation: {
				id: "conversation_123",
				title: null,
				createdAt: "2026-04-03T10:00:00.000Z",
				updatedAt: "2026-04-03T10:00:00.000Z",
				lastMessageAt: "2026-04-03T10:00:00.000Z",
				archivedAt: null,
			},
			messages: [],
			pagination: {
				limit: 50,
				offset: 0,
				hasMore: false,
			},
		}),
		getToolRuns: async () => ({
			toolRuns: [],
		}),
		approveToolRun: async () => ({
			toolRun: {
				id: "tool_run_123",
				conversationId: "conversation_123",
				agentId: "agent_123",
				externalUserId: "user_123",
				toolCallId: "tool_123",
				toolName: "cancel order",
				summary: "Cancel order",
				payload: {},
				payloadJson: "{}",
				status: "completed",
				decision: "approved",
				message: null,
				errorCode: null,
				output: null,
				createdAt: "2026-04-03T10:00:00.000Z",
				updatedAt: "2026-04-03T10:01:00.000Z",
				resolvedAt: "2026-04-03T10:01:00.000Z",
			},
			event: {
				type: "approval_resolved",
				decision: "approved",
				toolRun: {
					id: "tool_run_123",
					conversationId: "conversation_123",
					agentId: "agent_123",
					externalUserId: "user_123",
					toolCallId: "tool_123",
					toolName: "cancel order",
					summary: "Cancel order",
					payload: {},
					payloadJson: "{}",
					status: "completed",
					decision: "approved",
					message: null,
					errorCode: null,
					output: null,
					createdAt: "2026-04-03T10:00:00.000Z",
					updatedAt: "2026-04-03T10:01:00.000Z",
					resolvedAt: "2026-04-03T10:01:00.000Z",
				},
			},
			conversation: {
				id: "conversation_123",
				title: null,
				createdAt: "2026-04-03T10:00:00.000Z",
				updatedAt: "2026-04-03T10:01:00.000Z",
				lastMessageAt: "2026-04-03T10:01:00.000Z",
				archivedAt: null,
			},
		}),
		denyToolRun: async () => ({
			toolRun: {
				id: "tool_run_123",
				conversationId: "conversation_123",
				agentId: "agent_123",
				externalUserId: "user_123",
				toolCallId: "tool_123",
				toolName: "cancel order",
				summary: "Cancel order",
				payload: {},
				payloadJson: "{}",
				status: "denied",
				decision: "denied",
				message: null,
				errorCode: null,
				output: null,
				createdAt: "2026-04-03T10:00:00.000Z",
				updatedAt: "2026-04-03T10:01:00.000Z",
				resolvedAt: "2026-04-03T10:01:00.000Z",
			},
			event: {
				type: "approval_resolved",
				decision: "denied",
				toolRun: {
					id: "tool_run_123",
					conversationId: "conversation_123",
					agentId: "agent_123",
					externalUserId: "user_123",
					toolCallId: "tool_123",
					toolName: "cancel order",
					summary: "Cancel order",
					payload: {},
					payloadJson: "{}",
					status: "denied",
					decision: "denied",
					message: null,
					errorCode: null,
					output: null,
					createdAt: "2026-04-03T10:00:00.000Z",
					updatedAt: "2026-04-03T10:01:00.000Z",
					resolvedAt: "2026-04-03T10:01:00.000Z",
				},
			},
			conversation: {
				id: "conversation_123",
				title: null,
				createdAt: "2026-04-03T10:00:00.000Z",
				updatedAt: "2026-04-03T10:01:00.000Z",
				lastMessageAt: "2026-04-03T10:01:00.000Z",
				archivedAt: null,
			},
		}),
		completeToolRun: async (agentId, toolRunId, body) => ({
			toolRun: {
				id: toolRunId,
				conversationId: "conversation_123",
				agentId,
				externalUserId: "user_123",
				toolCallId: "tool_123",
				toolName: "cancel order",
				summary: "Cancel order",
				payload: {},
				payloadJson: "{}",
				status: body.status,
				decision: "approved",
				message: body.message ?? null,
				errorCode: body.errorCode ?? null,
				output: body.output ?? null,
				createdAt: "2026-04-03T10:00:00.000Z",
				updatedAt: "2026-04-03T10:01:00.000Z",
				resolvedAt: "2026-04-03T10:01:00.000Z",
			},
			event: {
				type: "tool_completed",
				toolRun: {
					id: toolRunId,
					conversationId: "conversation_123",
					agentId: "agent_123",
					externalUserId: "user_123",
					toolCallId: "tool_123",
					toolName: "cancel order",
					summary: "Cancel order",
					payload: {},
					payloadJson: "{}",
					status: body.status,
					decision: "approved",
					message: body.message ?? null,
					errorCode: body.errorCode ?? null,
					output: body.output ?? null,
					createdAt: "2026-04-03T10:00:00.000Z",
					updatedAt: "2026-04-03T10:01:00.000Z",
					resolvedAt: "2026-04-03T10:01:00.000Z",
				},
			},
			conversation: {
				id: "conversation_123",
				title: null,
				createdAt: "2026-04-03T10:00:00.000Z",
				updatedAt: "2026-04-03T10:01:00.000Z",
				lastMessageAt: "2026-04-03T10:01:00.000Z",
				archivedAt: null,
			},
		}),
		openStream: async () => ({
			stream: new ReadableStream<Uint8Array>(),
			conversationId: "conversation_123",
			responseHeaders: {},
		}),
		listConversations: async () => ({
			conversations: [],
			pagination: {
				limit: 50,
				offset: 0,
				hasMore: false,
			},
		}),
		renameConversation: async () => ({
			id: "conversation_123",
			title: "Support",
			createdAt: "2026-04-03T10:00:00.000Z",
			updatedAt: "2026-04-03T10:01:00.000Z",
			lastMessageAt: "2026-04-03T10:01:00.000Z",
			archivedAt: null,
		}),
		setConversationArchived: async () => ({
			id: "conversation_123",
			title: "Support",
			createdAt: "2026-04-03T10:00:00.000Z",
			updatedAt: "2026-04-03T10:01:00.000Z",
			lastMessageAt: "2026-04-03T10:01:00.000Z",
			archivedAt: null,
		}),
		...overrides,
	};
}
