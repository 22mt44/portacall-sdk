"use client";

import {
	type PortacallClient,
	type PortacallClientFetch,
	type PortacallClientHealth,
	type PortacallConversationPagination,
	type PortacallConversationSummary,
	type PortacallStreamEvent,
	portacall,
} from "@portacall/client";
import {
	createContext,
	type PropsWithChildren,
	type RefObject,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

const DEFAULT_CONVERSATION_PAGE_SIZE = 50;
const DEFAULT_MESSAGE_PAGE_SIZE = 100;

export type PortacallChatMessage = {
	id: string;
	role: "user" | "assistant";
	content: string;
	createdAt?: string;
	isStreaming?: boolean;
};

export type UsePortacallClientOptions = {
	backendURL: string | undefined;
	agentId: string;
	headers?: Record<string, string>;
	fetch?: PortacallClientFetch;
};

export type UsePortacallOptions = UsePortacallClientOptions & {
	externalUserId: string;
	storageKey?: string;
	autoTitle?: (message: string) => string;
	conversationPageSize?: number;
	messagePageSize?: number;
	initialShowArchived?: boolean;
};

export type PortacallProviderProps = PropsWithChildren<
	| {
			client: PortacallClient;
			backendURL?: never;
			agentId?: never;
			headers?: never;
			fetch?: never;
	  }
	| {
			client?: undefined;
			backendURL: string | undefined;
			agentId: string;
			headers?: Record<string, string>;
			fetch?: PortacallClientFetch;
	  }
>;

export type UsePortacallChatOptions = {
	client?: PortacallClient;
	externalUserId: string;
	storageKey?: string;
	autoTitle?: (message: string) => string;
	conversationPageSize?: number;
	messagePageSize?: number;
	initialShowArchived?: boolean;
};

export type UsePortacallChatResult = {
	configured: boolean | null;
	healthError: string;
	conversations: PortacallConversationSummary[];
	conversationPagination: PortacallConversationPagination;
	selectedConversation: PortacallConversationSummary | null;
	selectedConversationId: string | null;
	messages: PortacallChatMessage[];
	streamEvents: string[];
	error: string;
	isLoading: boolean;
	isStreaming: boolean;
	isLoadingConversations: boolean;
	isLoadingMessages: boolean;
	isMutatingConversation: boolean;
	isBusy: boolean;
	showArchived: boolean;
	setShowArchived: (value: boolean) => void;
	transcriptEndRef: RefObject<HTMLDivElement | null>;
	loadHealth: () => Promise<void>;
	refreshConversations: () => Promise<void>;
	loadMoreConversations: () => Promise<void>;
	loadConversation: (conversationId: string) => Promise<void>;
	sendMessage: (message: string) => Promise<boolean>;
	newConversation: () => Promise<void>;
	renameConversation: (
		conversationId: string,
		title: string,
	) => Promise<PortacallConversationSummary | null>;
	setConversationArchived: (
		conversationId: string,
		archived: boolean,
	) => Promise<PortacallConversationSummary | null>;
	deleteConversation: (conversationId: string) => Promise<boolean>;
	resetConversation: () => void;
	setErrorMessage: (message: string) => void;
	clearError: () => void;
	clearStreamEvents: () => void;
};

export type UsePortacallResult = UsePortacallChatResult & {
	client: PortacallClient;
};

const PortacallClientContext = createContext<PortacallClient | null>(null);

export function PortacallProvider({
	children,
	...props
}: PortacallProviderProps) {
	const createdClient = useStablePortacallClient(
		"client" in props && props.client
			? undefined
			: {
					backendURL: props.backendURL,
					agentId: props.agentId,
					headers: props.headers,
					fetch: props.fetch,
				},
	);
	const value =
		"client" in props && props.client ? props.client : createdClient;

	if (!value) {
		throw new Error(
			"PortacallProvider requires either a client instance or client configuration.",
		);
	}

	return (
		<PortacallClientContext.Provider value={value}>
			{children}
		</PortacallClientContext.Provider>
	);
}

export function usePortacallClient(
	options?: UsePortacallClientOptions,
): PortacallClient {
	const contextClient = useContext(PortacallClientContext);
	const createdClient = useStablePortacallClient(options);

	if (createdClient) {
		return createdClient;
	}

	if (contextClient) {
		return contextClient;
	}

	throw new Error(
		"usePortacallClient requires either explicit options or a PortacallProvider.",
	);
}

export function usePortacall({
	backendURL,
	agentId,
	headers,
	fetch,
	externalUserId,
	storageKey,
	autoTitle,
	conversationPageSize,
	messagePageSize,
	initialShowArchived,
}: UsePortacallOptions): UsePortacallResult {
	const client = usePortacallClient({
		backendURL,
		agentId,
		headers,
		fetch,
	});
	const chat = usePortacallChat({
		client,
		externalUserId,
		storageKey,
		autoTitle,
		conversationPageSize,
		messagePageSize,
		initialShowArchived,
	});

	return {
		client,
		...chat,
	};
}

export function usePortacallChat({
	client,
	externalUserId,
	storageKey,
	autoTitle,
	conversationPageSize = DEFAULT_CONVERSATION_PAGE_SIZE,
	messagePageSize = DEFAULT_MESSAGE_PAGE_SIZE,
	initialShowArchived = false,
}: UsePortacallChatOptions): UsePortacallChatResult {
	const contextClient = useContext(PortacallClientContext);
	const resolvedClient = client ?? contextClient;

	if (!resolvedClient) {
		throw new Error(
			"usePortacallChat requires a client option or a PortacallProvider.",
		);
	}

	const [showArchived, setShowArchived] = useState(initialShowArchived);
	const [conversations, setConversations] = useState<
		PortacallConversationSummary[]
	>([]);
	const [conversationPagination, setConversationPagination] =
		useState<PortacallConversationPagination>({
			limit: conversationPageSize,
			offset: 0,
			hasMore: false,
		});
	const [selectedConversationId, setSelectedConversationId] = useState<
		string | null
	>(null);
	const [messages, setMessages] = useState<PortacallChatMessage[]>([]);
	const [streamEvents, setStreamEvents] = useState<string[]>([]);
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [isStreaming, setIsStreaming] = useState(false);
	const [isLoadingConversations, setIsLoadingConversations] = useState(false);
	const [isLoadingMessages, setIsLoadingMessages] = useState(false);
	const [isMutatingConversation, setIsMutatingConversation] = useState(false);
	const [configured, setConfigured] = useState<boolean | null>(null);
	const [healthError, setHealthError] = useState("");
	const transcriptEndRef = useRef<HTMLDivElement | null>(null);

	const selectedConversation = useMemo(
		() =>
			conversations.find((entry) => entry.id === selectedConversationId) ??
			null,
		[conversations, selectedConversationId],
	);
	const messageCount = messages.length;
	const isBusy = useMemo(
		() =>
			isLoading || isStreaming || isLoadingMessages || isMutatingConversation,
		[isLoading, isLoadingMessages, isMutatingConversation, isStreaming],
	);

	const syncConversation = useCallback(
		(nextConversation: PortacallConversationSummary) => {
			setConversations((current) =>
				sortConversations(
					[
						nextConversation,
						...current.filter((entry) => entry.id !== nextConversation.id),
					],
					showArchived,
				),
			);
		},
		[showArchived],
	);

	const appendStreamEvent = useCallback((label: string) => {
		setStreamEvents((current) => [...current, label]);
	}, []);

	const resetConversationState = useCallback(() => {
		setSelectedConversationId(null);
		setMessages([]);
		setStreamEvents([]);
	}, []);

	const loadHealth = useCallback(async () => {
		try {
			setHealthError("");
			const payload = await resolvedClient.health();
			setConfigured(payload.configured);
		} catch (nextError) {
			setConfigured(null);
			setHealthError(getErrorMessage(nextError, "Unknown health error."));
		}
	}, [resolvedClient]);

	const loadConversations = useCallback(
		async (offset = 0) => {
			const normalizedUserId = externalUserId.trim();
			if (!normalizedUserId) {
				setConversations([]);
				setConversationPagination({
					limit: conversationPageSize,
					offset: 0,
					hasMore: false,
				});
				return;
			}

			try {
				setIsLoadingConversations(true);
				setError("");
				const response = await resolvedClient.getConversations(
					normalizedUserId,
					{
						limit: conversationPageSize,
						offset,
						includeArchived: showArchived,
					},
				);

				setConversationPagination(response.pagination);
				setConversations((current) =>
					offset === 0
						? response.conversations
						: mergeConversationLists(current, response.conversations),
				);
			} catch (nextError) {
				setError(getErrorMessage(nextError, "Unknown conversation error."));
			} finally {
				setIsLoadingConversations(false);
			}
		},
		[conversationPageSize, externalUserId, resolvedClient, showArchived],
	);

	const refreshConversations = useCallback(async () => {
		await loadConversations();
	}, [loadConversations]);

	const loadMoreConversations = useCallback(async () => {
		await loadConversations(conversations.length);
	}, [conversations.length, loadConversations]);

	const loadConversation = useCallback(
		async (conversationId: string) => {
			try {
				setIsLoadingMessages(true);
				setError("");
				const response = await resolvedClient.getConversationMessages(
					conversationId,
					externalUserId,
					{
						limit: messagePageSize,
					},
				);

				setSelectedConversationId(response.conversation.id);
				setMessages(
					response.messages.map((entry) => ({
						id: entry.id,
						role: entry.role,
						content: entry.content,
						createdAt: entry.createdAt,
					})),
				);
				setStreamEvents([]);
				syncConversation(response.conversation);
			} catch (nextError) {
				setError(getErrorMessage(nextError, "Unknown history error."));
			} finally {
				setIsLoadingMessages(false);
			}
		},
		[externalUserId, messagePageSize, resolvedClient, syncConversation],
	);

	const sendMessage = useCallback(
		async (message: string) => {
			const nextMessage = message.trim();
			if (!nextMessage || isBusy) {
				return false;
			}

			setError("");
			setStreamEvents([]);

			const userMessage: PortacallChatMessage = {
				id: crypto.randomUUID(),
				role: "user",
				content: nextMessage,
			};

			setIsLoading(true);

			let activeConversationId = selectedConversationId;
			let shouldAutotitle = selectedConversation?.title == null;

			try {
				if (!activeConversationId) {
					const conversation =
						await resolvedClient.createConversation(externalUserId);
					activeConversationId = conversation.id;
					shouldAutotitle = true;
					setSelectedConversationId(conversation.id);
					syncConversation(conversation);
				}
			} catch (nextError) {
				setError(
					getErrorMessage(nextError, "Unknown conversation creation error."),
				);
				setIsLoading(false);
				return false;
			}

			const assistantMessageId = crypto.randomUUID();
			setIsLoading(false);
			setIsStreaming(true);
			setMessages((current) => [
				...current,
				userMessage,
				{
					id: assistantMessageId,
					role: "assistant",
					content: "",
					isStreaming: true,
				},
			]);

			try {
				let nextContent = "";

				for await (const event of resolvedClient.stream(nextMessage, {
					externalUserId,
					conversationId: activeConversationId,
				})) {
					if (event.type === "conversation_id") {
						activeConversationId = event.conversationId;
						setSelectedConversationId(event.conversationId);
						continue;
					}

					if (event.type === "text_delta") {
						nextContent += event.text;
						setMessages((current) =>
							current.map((entry) =>
								entry.id === assistantMessageId
									? { ...entry, content: nextContent, isStreaming: true }
									: entry,
							),
						);
						continue;
					}

					if (event.type === "tool_call_started") {
						appendStreamEvent(`Started ${event.toolName}`);
						continue;
					}

					if (event.type === "tool_call_completed") {
						appendStreamEvent(
							`Completed ${event.toolName} (${event.status === "completed" ? "completed" : "accepted"})`,
						);
						continue;
					}

					if (event.type === "tool_call_failed") {
						appendStreamEvent(`Failed ${event.toolName}: ${event.message}`);
						continue;
					}

					if (event.type === "error") {
						throw new Error(event.message);
					}
				}

				setMessages((current) =>
					current.map((entry) =>
						entry.id === assistantMessageId
							? { ...entry, isStreaming: false }
							: entry,
					),
				);

				if (activeConversationId && shouldAutotitle && autoTitle) {
					try {
						const nextTitle = autoTitle(nextMessage).trim();
						if (nextTitle) {
							const conversation = await resolvedClient.renameConversation(
								activeConversationId,
								externalUserId,
								nextTitle,
							);
							syncConversation(conversation);
						}
					} catch {
						// Keep the untitled conversation if automatic rename fails.
					}
				}

				await loadConversations();
				return true;
			} catch (nextError) {
				setError(getErrorMessage(nextError, "Unknown stream error."));
				setMessages((current) =>
					current.filter((entry) => entry.id !== assistantMessageId),
				);
				return false;
			} finally {
				setIsStreaming(false);
			}
		},
		[
			appendStreamEvent,
			autoTitle,
			externalUserId,
			isBusy,
			loadConversations,
			resolvedClient,
			selectedConversation?.title,
			selectedConversationId,
			syncConversation,
		],
	);

	const newConversation = useCallback(async () => {
		if (isBusy) {
			return;
		}

		setError("");
		resetConversationState();
		resolvedClient.resetConversation();

		try {
			setIsMutatingConversation(true);
			const conversation =
				await resolvedClient.createConversation(externalUserId);
			setSelectedConversationId(conversation.id);
			syncConversation(conversation);
			await loadConversations();
		} catch (nextError) {
			setError(
				getErrorMessage(nextError, "Unknown conversation creation error."),
			);
		} finally {
			setIsMutatingConversation(false);
		}
	}, [
		externalUserId,
		isBusy,
		loadConversations,
		resetConversationState,
		resolvedClient,
		syncConversation,
	]);

	const renameConversation = useCallback(
		async (conversationId: string, title: string) => {
			try {
				setIsMutatingConversation(true);
				const updatedConversation = await resolvedClient.renameConversation(
					conversationId,
					externalUserId,
					title,
				);
				syncConversation(updatedConversation);
				return updatedConversation;
			} catch (nextError) {
				setError(getErrorMessage(nextError, "Unknown rename error."));
				return null;
			} finally {
				setIsMutatingConversation(false);
			}
		},
		[externalUserId, resolvedClient, syncConversation],
	);

	const setConversationArchived = useCallback(
		async (conversationId: string, archived: boolean) => {
			try {
				setIsMutatingConversation(true);
				const updatedConversation = archived
					? await resolvedClient.archiveConversation(
							conversationId,
							externalUserId,
						)
					: await resolvedClient.unarchiveConversation(
							conversationId,
							externalUserId,
						);

				syncConversation(updatedConversation);
				await loadConversations();

				if (updatedConversation.archivedAt && !showArchived) {
					if (selectedConversationId === updatedConversation.id) {
						resetConversationState();
					}
				}

				return updatedConversation;
			} catch (nextError) {
				setError(getErrorMessage(nextError, "Unknown archive error."));
				return null;
			} finally {
				setIsMutatingConversation(false);
			}
		},
		[
			externalUserId,
			loadConversations,
			resetConversationState,
			resolvedClient,
			selectedConversationId,
			showArchived,
			syncConversation,
		],
	);

	const deleteConversation = useCallback(
		async (conversationId: string) => {
			try {
				setIsMutatingConversation(true);
				await resolvedClient.deleteConversation(conversationId, externalUserId);
				setConversations((current) =>
					current.filter((entry) => entry.id !== conversationId),
				);

				if (selectedConversationId === conversationId) {
					resetConversationState();
				}

				return true;
			} catch (nextError) {
				setError(getErrorMessage(nextError, "Unknown delete error."));
				return false;
			} finally {
				setIsMutatingConversation(false);
			}
		},
		[
			externalUserId,
			resetConversationState,
			resolvedClient,
			selectedConversationId,
		],
	);

	const resetConversation = useCallback(() => {
		resolvedClient.resetConversation();
		resetConversationState();
		setError("");
	}, [resetConversationState, resolvedClient]);

	const clearError = useCallback(() => {
		setError("");
	}, []);

	const clearStreamEvents = useCallback(() => {
		setStreamEvents([]);
	}, []);

	const setErrorMessage = useCallback((message: string) => {
		setError(message);
	}, []);

	useEffect(() => {
		void loadHealth();
	}, [loadHealth]);

	useEffect(() => {
		if (messageCount === 0) {
			return;
		}

		transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messageCount]);

	useEffect(() => {
		if (typeof window !== "undefined" && storageKey) {
			window.localStorage.setItem(storageKey, externalUserId);
		}

		resolvedClient.resetConversation();
		resetConversationState();
		setError("");
	}, [externalUserId, resetConversationState, resolvedClient, storageKey]);

	useEffect(() => {
		void loadConversations();
	}, [loadConversations]);

	return {
		configured,
		healthError,
		conversations,
		conversationPagination,
		selectedConversation,
		selectedConversationId,
		messages,
		streamEvents,
		error,
		isLoading,
		isStreaming,
		isLoadingConversations,
		isLoadingMessages,
		isMutatingConversation,
		isBusy,
		showArchived,
		setShowArchived,
		transcriptEndRef,
		loadHealth,
		refreshConversations,
		loadMoreConversations,
		loadConversation,
		sendMessage,
		newConversation,
		renameConversation,
		setConversationArchived,
		deleteConversation,
		resetConversation,
		setErrorMessage,
		clearError,
		clearStreamEvents,
	};
}

function useStablePortacallClient(
	options?: UsePortacallClientOptions,
): PortacallClient | null {
	const agentId = options?.agentId;
	const backendURL = options?.backendURL;
	const fetchImpl = options?.fetch;
	const headers = options?.headers;
	const headersKey = useMemo(() => createHeadersKey(headers), [headers]);
	const stableHeaders = useMemo(() => {
		if (!headersKey) {
			return undefined;
		}

		return Object.fromEntries(
			(JSON.parse(headersKey) as Array<[string, string]>).map(
				([key, value]) => [key, value],
			),
		);
	}, [headersKey]);

	return useMemo(() => {
		if (!agentId) {
			return null;
		}

		return portacall(backendURL, agentId, {
			headers: stableHeaders,
			fetch: fetchImpl,
		});
	}, [agentId, backendURL, fetchImpl, stableHeaders]);
}

function createHeadersKey(
	headers: Record<string, string> | undefined,
): string | null {
	if (!headers) {
		return null;
	}

	return JSON.stringify(
		Object.entries(headers).sort(([left], [right]) =>
			left.localeCompare(right),
		),
	);
}

function mergeConversationLists(
	current: PortacallConversationSummary[],
	next: PortacallConversationSummary[],
): PortacallConversationSummary[] {
	return sortConversations(
		[
			...current.filter(
				(existing) => !next.some((incoming) => incoming.id === existing.id),
			),
			...next,
		],
		true,
	);
}

function sortConversations(
	entries: PortacallConversationSummary[],
	includeArchived: boolean,
): PortacallConversationSummary[] {
	return entries
		.filter((entry) => includeArchived || entry.archivedAt == null)
		.sort(
			(left, right) =>
				new Date(right.lastMessageAt).getTime() -
				new Date(left.lastMessageAt).getTime(),
		);
}

function getErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof Error) {
		return error.message;
	}

	return fallback;
}

export type {
	PortacallClient,
	PortacallClientFetch,
	PortacallClientHealth,
	PortacallConversationPagination,
	PortacallConversationSummary,
	PortacallStreamEvent,
};
