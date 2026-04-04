import { describe, expect, test } from "bun:test";
import { handlePortacallRequest } from "./handler";

describe("handlePortacallRequest", () => {
	test("forwards approve action-run requests", async () => {
		const calls: Array<{
			agentId: string;
			actionRunId: string;
			externalUserId: string;
		}> = [];

		const response = await handlePortacallRequest(
			createMockPortacall({
				approveActionRun: async (agentId, actionRunId, externalUserId) => {
					calls.push({ agentId, actionRunId, externalUserId });
					return {
						actionRun: {
							id: actionRunId,
							conversationId: "conversation_123",
							agentId,
							externalUserId,
							toolCallId: "tool_123",
							actionName: "cancel order",
							summary: "Cancel order",
							payload: { orderId: "34567" },
							payloadJson: '{"orderId":"34567"}',
							status: "completed",
							decision: "approved",
							message: null,
							errorCode: null,
							createdAt: "2026-04-03T10:00:00.000Z",
							updatedAt: "2026-04-03T10:01:00.000Z",
							resolvedAt: "2026-04-03T10:01:00.000Z",
						},
						event: {
							type: "approval_resolved" as const,
							decision: "approved" as const,
							actionRun: {
								id: actionRunId,
								conversationId: "conversation_123",
								agentId,
								externalUserId,
								toolCallId: "tool_123",
								actionName: "cancel order",
								summary: "Cancel order",
								payload: { orderId: "34567" },
								payloadJson: '{"orderId":"34567"}',
								status: "completed" as const,
								decision: "approved" as const,
								message: null,
								errorCode: null,
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
				"https://example.com/api/portacall/agent_123/action-runs/action_run_123/approve",
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
				actionRunId: "action_run_123",
				externalUserId: "user_123",
			},
		]);
	});

	test("lists action runs for a conversation", async () => {
		const response = await handlePortacallRequest(
			createMockPortacall({
				getActionRuns: async (
					agentId,
					conversationId,
					externalUserId,
					options,
				) => ({
					actionRuns: [
						{
							id: "action_run_123",
							conversationId,
							agentId,
							externalUserId,
							toolCallId: "tool_123",
							actionName: "cancel order",
							summary: "Cancel order",
							payload: { orderId: "34567" },
							payloadJson: '{"orderId":"34567"}',
							status: options?.status === "pending" ? "pending" : "completed",
							decision: "pending",
							message: null,
							errorCode: null,
							createdAt: "2026-04-03T10:00:00.000Z",
							updatedAt: "2026-04-03T10:00:00.000Z",
							resolvedAt: null,
						},
					],
				}),
			}),
			new Request(
				"https://example.com/api/portacall/agent_123/conversations/conversation_123/action-runs?externalUserId=user_123&status=pending",
			),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			actionRuns: [
				expect.objectContaining({
					id: "action_run_123",
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
		getActionRuns: async () => ({
			actionRuns: [],
		}),
		approveActionRun: async () => ({
			actionRun: {
				id: "action_run_123",
				conversationId: "conversation_123",
				agentId: "agent_123",
				externalUserId: "user_123",
				toolCallId: "tool_123",
				actionName: "cancel order",
				summary: "Cancel order",
				payload: {},
				payloadJson: "{}",
				status: "completed",
				decision: "approved",
				message: null,
				errorCode: null,
				createdAt: "2026-04-03T10:00:00.000Z",
				updatedAt: "2026-04-03T10:01:00.000Z",
				resolvedAt: "2026-04-03T10:01:00.000Z",
			},
			event: {
				type: "approval_resolved",
				decision: "approved",
				actionRun: {
					id: "action_run_123",
					conversationId: "conversation_123",
					agentId: "agent_123",
					externalUserId: "user_123",
					toolCallId: "tool_123",
					actionName: "cancel order",
					summary: "Cancel order",
					payload: {},
					payloadJson: "{}",
					status: "completed",
					decision: "approved",
					message: null,
					errorCode: null,
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
		denyActionRun: async () => ({
			actionRun: {
				id: "action_run_123",
				conversationId: "conversation_123",
				agentId: "agent_123",
				externalUserId: "user_123",
				toolCallId: "tool_123",
				actionName: "cancel order",
				summary: "Cancel order",
				payload: {},
				payloadJson: "{}",
				status: "denied",
				decision: "denied",
				message: null,
				errorCode: null,
				createdAt: "2026-04-03T10:00:00.000Z",
				updatedAt: "2026-04-03T10:01:00.000Z",
				resolvedAt: "2026-04-03T10:01:00.000Z",
			},
			event: {
				type: "approval_resolved",
				decision: "denied",
				actionRun: {
					id: "action_run_123",
					conversationId: "conversation_123",
					agentId: "agent_123",
					externalUserId: "user_123",
					toolCallId: "tool_123",
					actionName: "cancel order",
					summary: "Cancel order",
					payload: {},
					payloadJson: "{}",
					status: "denied",
					decision: "denied",
					message: null,
					errorCode: null,
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
