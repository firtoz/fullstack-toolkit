import { exhaustiveGuard } from "@firtoz/maybe-error";
import { OpenRouter } from "@openrouter/sdk";

// OpenRouter SDK message types (simplified for our use)
type ORToolCall = {
	id: string;
	type: "function";
	function: { name: string; arguments: string };
} & Record<string, unknown>;

type ORSystemMessage = { role: "system"; content: string };
type ORUserMessage = { role: "user"; content: string };
type ORAssistantMessage = {
	role: "assistant";
	content?: string | null;
	toolCalls?: ORToolCall[];
};
type ORToolMessage = { role: "tool"; content: string; toolCallId: string };
type OpenRouterMessage =
	| ORSystemMessage
	| ORUserMessage
	| ORAssistantMessage
	| ORToolMessage;

import {
	Agent,
	type AgentContext,
	type Connection,
	type ConnectionContext,
} from "agents";
import {
	type AssistantMessage,
	type ChatMessage,
	isAssistantMessage,
	type ServerMessage,
	safeParseClientMessage,
	type TokenUsage,
	type ToolCall,
	type ToolCallDelta,
	type ToolDefinition,
	type ToolMessage,
	type UserMessage,
	type SendMessagePayload,
} from "./chat-messages";

// Re-export types for external use
export type {
	AssistantMessage,
	ChatMessage,
	ClientMessage,
	ServerMessage,
	TokenUsage,
	ToolCall,
	ToolDefinition,
	ToolMessage,
	UserMessage,
	ToolNeedsApprovalFn,
	SendMessagePayload,
	SendMessageTrigger,
	ToolApprovalResponsePayload,
	ToolApprovalRequestMessage,
} from "./chat-messages";
export { defineTool } from "./chat-messages";

// ============================================================================
// Constants
// ============================================================================

/** Default system prompt - override getSystemPrompt() to customize */
const DEFAULT_SYSTEM_PROMPT = "You are a helpful AI assistant.";

/** Number of chunks to buffer before flushing to SQLite */
const CHUNK_BUFFER_SIZE = 10;
/** Maximum buffer size to prevent memory issues */
const CHUNK_BUFFER_MAX_SIZE = 100;
/** Maximum age for a "streaming" stream before considering it stale (5 minutes) */
const STREAM_STALE_THRESHOLD_MS = 5 * 60 * 1000;
/** Cleanup interval for old streams (10 minutes) */
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
/** Age threshold for cleaning up completed streams (24 hours) */
const CLEANUP_AGE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/** Default max length for persisted tool message `content` (characters) */
const DEFAULT_MAX_TOOL_CONTENT_CHARS = 200_000;

/** OpenAI stream keys on each tool_calls[] element (camelCase or snake_case) */
const STREAM_TOOL_TOP_KEYS = new Set(["index", "id", "type", "function"]);

function getRawToolCallDeltaEntry(
	chunk: unknown,
	index: number,
): Record<string, unknown> | undefined {
	const c = chunk as {
		choices?: Array<{ delta?: Record<string, unknown> }>;
	};
	const delta = c.choices?.[0]?.delta;
	if (!delta) {
		return undefined;
	}
	const list = (delta.tool_calls ?? delta.toolCalls) as unknown;
	if (!Array.isArray(list) || index < 0 || index >= list.length) {
		return undefined;
	}
	const raw = list[index];
	if (!raw || typeof raw !== "object") {
		return undefined;
	}
	return raw as Record<string, unknown>;
}

function extractProviderMetadataFromRawToolPart(
	raw: Record<string, unknown>,
): Record<string, unknown> | undefined {
	const meta: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(raw)) {
		if (STREAM_TOOL_TOP_KEYS.has(k)) {
			continue;
		}
		meta[k] = v;
	}
	const fn = raw.function;
	if (fn && typeof fn === "object" && !Array.isArray(fn)) {
		const f = fn as Record<string, unknown>;
		const fnExtra: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(f)) {
			if (k === "name" || k === "arguments") {
				continue;
			}
			fnExtra[k] = v;
		}
		if (Object.keys(fnExtra).length > 0) {
			meta.function = fnExtra;
		}
	}
	return Object.keys(meta).length > 0 ? meta : undefined;
}

type PendingClientToolAutoContinue = {
	connection: Connection;
	toolCallId: string;
	toolName: string;
	output: unknown;
};

type PendingToolApproval = {
	resolve: (approved: boolean) => void;
};

// ============================================================================
// ChatAgent Class
// ============================================================================

/**
 * ChatAgentBase - Abstract base class for AI chat agents
 *
 * Features:
 * - DB-agnostic SQLite persistence in Durable Objects
 * - Resumable streaming with chunk buffering (like @cloudflare/ai-chat)
 * - Broadcast of stream and history updates to all WebSocket connections (multi-tab)
 * - Serialized chat turns + batched client tool auto-continue
 * - OpenRouter via Cloudflare AI Gateway
 *
 * Subclasses must implement database operations via abstract methods.
 *
 * @template Env - Environment bindings type (must include OPENROUTER_API_KEY, optionally AI Gateway config)
 */
export abstract class ChatAgentBase<
	Env extends Cloudflare.Env & {
		OPENROUTER_API_KEY: string;
	} = Cloudflare.Env & { OPENROUTER_API_KEY: string },
> extends Agent<Env> {
	/** In-memory cache of messages */
	messages: ChatMessage[] = [];

	/**
	 * When set, oldest messages are deleted from storage after each save so only the last N remain.
	 * Does not change what is sent to the model unless you prune separately.
	 */
	protected maxPersistedMessages?: number;

	/** Map of message IDs to AbortControllers for request cancellation */
	private _abortControllers: Map<string, AbortController> = new Map();

	/** Currently active stream ID */
	private _activeStreamId: string | null = null;
	/** Message ID being streamed */
	private _activeMessageId: string | null = null;
	/** True only while the OpenRouter async iterator for the active stream is running */
	private _openRouterStreamLive = false;
	/** Current chunk index for active stream */
	private _streamChunkIndex = 0;
	/** Buffer for chunks pending write */
	private _chunkBuffer: Array<{
		streamId: string;
		content: string;
		index: number;
	}> = [];
	/** Lock for flush operations */
	private _isFlushingChunks = false;
	/** Last cleanup timestamp */
	private _lastCleanupTime = 0;

	/** Client-registered tools (tools defined at runtime from frontend) */
	private _clientTools: Map<
		string,
		{ name: string; description?: string; parameters?: Record<string, unknown> }
	> = new Map();

	/** FIFO serialization of chat turns (user sends, tool continuations, etc.) */
	private _turnTail: Promise<void> = Promise.resolve();
	/** Bumped by {@link resetTurnState} to ignore stale async work */
	private _turnGeneration = 0;

	/** Connection id that last queued an auto-continue after client tools (for multi-tab hints) */
	private _continuationOriginConnectionId: string | null = null;

	private _pendingClientToolAutoContinue: PendingClientToolAutoContinue[] = [];
	private _clientToolAutoContinueFlushScheduled = false;

	/** Human-in-the-loop: server tools awaiting `toolApprovalResponse` (not queued — avoids deadlock). */
	private _pendingToolApprovals: Map<string, PendingToolApproval> = new Map();

	// ============================================================================
	// Constructor - Following @cloudflare/ai-chat pattern
	// ============================================================================

	constructor(ctx: AgentContext, env: Env) {
		super(ctx, env);

		// Initialize database (subclass-specific)
		this.dbInitialize();

		// Load messages from DB
		this.messages = this.dbLoadMessages();

		// Restore any active stream from a previous session (never live after restore)
		this._restoreActiveStream();
		this._openRouterStreamLive = false;

		// Wrap onConnect to handle stream resumption
		const _onConnect = this.onConnect.bind(this);
		this.onConnect = async (
			connection: Connection,
			connCtx: ConnectionContext,
		) => {
			if (this._activeStreamId && this._activeMessageId) {
				this._notifyStreamResuming(connection);
			}
			return _onConnect(connection, connCtx);
		};
	}

	// ============================================================================
	// Abstract Database Methods - Subclasses must implement
	// ============================================================================

	/**
	 * Initialize database and run migrations
	 * Called once during constructor
	 */
	protected abstract dbInitialize(): void;

	/**
	 * Load all messages from database
	 * @returns Array of chat messages ordered by createdAt
	 */
	protected abstract dbLoadMessages(): ChatMessage[];

	/**
	 * Save or update a message in database
	 * @param msg - The message to save
	 */
	protected abstract dbSaveMessage(msg: ChatMessage): void;

	/**
	 * Clear all data (messages, streams, chunks)
	 */
	protected abstract dbClearAll(): void;

	/**
	 * Find an active streaming session
	 * @returns Stream info or null if none active
	 */
	protected abstract dbFindActiveStream(): {
		id: string;
		messageId: string;
		createdAt: Date;
	} | null;

	/**
	 * Delete a stream and all its chunks
	 * @param streamId - The stream to delete
	 */
	protected abstract dbDeleteStreamWithChunks(streamId: string): void;

	/**
	 * Create a new stream metadata entry
	 * @param streamId - Unique stream identifier
	 * @param messageId - Associated message ID
	 */
	protected abstract dbInsertStreamMetadata(
		streamId: string,
		messageId: string,
	): void;

	/**
	 * Update stream status to completed or error
	 * @param streamId - The stream to update
	 * @param status - New status
	 */
	protected abstract dbUpdateStreamStatus(
		streamId: string,
		status: "completed" | "error",
	): void;

	/**
	 * Delete old completed streams older than cutoff
	 * @param cutoffMs - Timestamp in milliseconds
	 */
	protected abstract dbDeleteOldCompletedStreams(cutoffMs: number): void;

	/**
	 * Find the maximum chunk index for a stream
	 * @param streamId - The stream to query
	 * @returns Max chunk index or null if no chunks
	 */
	protected abstract dbFindMaxChunkIndex(streamId: string): number | null;

	/**
	 * Insert multiple stream chunks
	 * @param chunks - Array of chunks to insert
	 */
	protected abstract dbInsertChunks(
		chunks: Array<{
			id: string;
			streamId: string;
			content: string;
			chunkIndex: number;
		}>,
	): void;

	/**
	 * Get all chunks for a stream, ordered by index
	 * @param streamId - The stream to query
	 * @returns Array of chunk content strings
	 */
	protected abstract dbGetChunks(streamId: string): string[];

	/**
	 * Delete all chunks for a stream
	 * @param streamId - The stream to clean up
	 */
	protected abstract dbDeleteChunks(streamId: string): void;

	/**
	 * Whether stream metadata or chunks exist for this stream id
	 */
	protected abstract dbIsStreamKnown(streamId: string): boolean;

	/**
	 * Delete oldest messages until at most `maxMessages` rows remain
	 */
	protected abstract dbTrimMessagesToMax(maxMessages: number): void;

	/**
	 * Replace all chat messages (used for client sync / regenerate). Implementations should delete existing rows then insert.
	 */
	protected abstract dbReplaceAllMessages(messages: ChatMessage[]): void;

	// ============================================================================
	// Persistence hooks (override in subclasses)
	// ============================================================================

	/**
	 * Transform a message immediately before it is written to storage.
	 * Default: return the message unchanged.
	 */
	protected sanitizeMessageForPersistence(msg: ChatMessage): ChatMessage {
		return msg;
	}

	// ============================================================================
	// Turn coordination (subclasses / host code)
	// ============================================================================

	/**
	 * Resolves after all queued turns have finished and no OpenRouter stream is active.
	 */
	protected waitUntilStable(): Promise<void> {
		return this._turnTail.then(async () => {
			while (this._openRouterStreamLive) {
				await new Promise((r) => queueMicrotask(r));
			}
		});
	}

	/**
	 * Abort in-flight generation, clear pending client tool auto-continue batch, and invalidate queued async work.
	 * Call from custom clear handlers; {@link clearHistory} path also resets state.
	 */
	protected resetTurnState(): void {
		this._turnGeneration++;
		this._pendingClientToolAutoContinue = [];
		this._clientToolAutoContinueFlushScheduled = false;
		this._continuationOriginConnectionId = null;
		for (const p of this._pendingToolApprovals.values()) {
			p.resolve(false);
		}
		this._pendingToolApprovals.clear();
		for (const id of [...this._abortControllers.keys()]) {
			this._cancelRequest(id);
		}
	}

	/**
	 * True when the last assistant message still has tool calls without matching tool role replies.
	 */
	protected hasPendingInteraction(): boolean {
		if (this._pendingToolApprovals.size > 0) {
			return true;
		}
		const last = this.messages[this.messages.length - 1];
		if (last?.role !== "assistant") {
			return false;
		}
		if (!last.toolCalls?.length) {
			return false;
		}
		const pending = new Set(last.toolCalls.map((t) => t.id));
		for (const m of this.messages) {
			if (m.role === "tool" && pending.has(m.toolCallId)) {
				pending.delete(m.toolCallId);
			}
		}
		return pending.size > 0;
	}

	// ============================================================================
	// Message Persistence
	// ============================================================================

	private _persistMessage(msg: ChatMessage): void {
		const sanitized = this.sanitizeMessageForPersistence(msg);
		const stored = this._maybeTruncateToolMessageContent(sanitized);
		this.dbSaveMessage(stored);
		const max = this.maxPersistedMessages;
		if (typeof max === "number" && max > 0) {
			this.dbTrimMessagesToMax(max);
			this.messages = this.dbLoadMessages();
		}
	}

	private _maybeTruncateToolMessageContent(msg: ChatMessage): ChatMessage {
		if (msg.role !== "tool") {
			return msg;
		}
		const content = msg.content;
		if (content.length <= DEFAULT_MAX_TOOL_CONTENT_CHARS) {
			return msg;
		}
		const truncated =
			content.slice(0, DEFAULT_MAX_TOOL_CONTENT_CHARS) +
			`\n… [truncated ${content.length - DEFAULT_MAX_TOOL_CONTENT_CHARS} chars for storage]`;
		return { ...msg, content: truncated };
	}

	private _clearMessages(): void {
		this.resetTurnState();
		this.dbClearAll();
		this._activeStreamId = null;
		this._activeMessageId = null;
		this._streamChunkIndex = 0;
		this._chunkBuffer = [];
		this.messages = [];
	}

	// ============================================================================
	// Stream Restoration (following @cloudflare/ai-chat pattern)
	// ============================================================================

	/**
	 * Restore active stream state if the agent was restarted during streaming.
	 * Called during construction to recover any interrupted streams.
	 */
	private _restoreActiveStream(): void {
		const stream = this.dbFindActiveStream();
		if (!stream) {
			return;
		}

		const streamAge = Date.now() - stream.createdAt.getTime();

		// Delete stale streams
		if (streamAge > STREAM_STALE_THRESHOLD_MS) {
			this.dbDeleteStreamWithChunks(stream.id);
			console.warn(
				`[ChatAgent] Deleted stale stream ${stream.id} (age: ${Math.round(streamAge / 1000)}s)`,
			);
			return;
		}

		this._activeStreamId = stream.id;
		this._activeMessageId = stream.messageId;

		// Get the last chunk index
		const maxIndex = this.dbFindMaxChunkIndex(stream.id);
		this._streamChunkIndex = maxIndex != null ? maxIndex + 1 : 0;
	}

	/**
	 * Notify a connection about an active stream that can be resumed.
	 */
	private _notifyStreamResuming(connection: Connection): void {
		if (!this._activeStreamId || !this._activeMessageId) {
			return;
		}

		this._sendTo(connection, {
			type: "streamResuming",
			id: this._activeMessageId,
			streamId: this._activeStreamId,
		});
	}

	// ============================================================================
	// Stream Chunk Management
	// ============================================================================

	private _storeChunk(streamId: string, content: string): void {
		// Force flush if buffer is at max
		if (this._chunkBuffer.length >= CHUNK_BUFFER_MAX_SIZE) {
			this._flushChunkBuffer();
		}

		this._chunkBuffer.push({
			streamId,
			content,
			index: this._streamChunkIndex++,
		});

		// Flush when buffer reaches threshold
		if (this._chunkBuffer.length >= CHUNK_BUFFER_SIZE) {
			this._flushChunkBuffer();
		}
	}

	private _flushChunkBuffer(): void {
		if (this._isFlushingChunks || this._chunkBuffer.length === 0) {
			return;
		}

		this._isFlushingChunks = true;
		try {
			const chunks = this._chunkBuffer;
			this._chunkBuffer = [];

			// Convert to format expected by dbInsertChunks
			const chunksToInsert = chunks.map((chunk) => ({
				id: crypto.randomUUID(),
				streamId: chunk.streamId,
				content: chunk.content,
				chunkIndex: chunk.index,
			}));

			this.dbInsertChunks(chunksToInsert);
		} finally {
			this._isFlushingChunks = false;
		}
	}

	private _startStream(messageId: string): string {
		// Flush any pending chunks from previous streams
		this._flushChunkBuffer();

		const streamId = crypto.randomUUID();
		this._activeStreamId = streamId;
		this._activeMessageId = messageId;
		this._streamChunkIndex = 0;

		this.dbInsertStreamMetadata(streamId, messageId);

		return streamId;
	}

	/**
	 * Complete stream with a full message (supports tool calls)
	 */
	private _completeStreamWithMessage(
		streamId: string,
		message: AssistantMessage,
	): void {
		// Flush any pending chunks
		this._flushChunkBuffer();

		this.dbUpdateStreamStatus(streamId, "completed");

		// Save the complete message
		this._persistMessage(message);
		if (typeof this.maxPersistedMessages !== "number") {
			this.messages.push(message);
		}

		// Clean up stream chunks
		this.dbDeleteChunks(streamId);

		this._activeStreamId = null;
		this._activeMessageId = null;
		this._streamChunkIndex = 0;

		// Periodically clean up old streams
		this._maybeCleanupOldStreams();
	}

	private _markStreamError(streamId: string): void {
		this._flushChunkBuffer();

		this.dbUpdateStreamStatus(streamId, "error");

		this._activeStreamId = null;
		this._activeMessageId = null;
		this._streamChunkIndex = 0;
	}

	/**
	 * Clean up old completed streams periodically.
	 */
	private _maybeCleanupOldStreams(): void {
		const now = Date.now();
		if (now - this._lastCleanupTime < CLEANUP_INTERVAL_MS) {
			return;
		}
		this._lastCleanupTime = now;

		const cutoffMs = now - CLEANUP_AGE_THRESHOLD_MS;
		this.dbDeleteOldCompletedStreams(cutoffMs);
	}

	private _getStreamChunks(streamId: string): string[] {
		// Flush first to ensure all chunks are persisted
		this._flushChunkBuffer();

		return this.dbGetChunks(streamId);
	}

	/**
	 * Finalize a stream that has buffered chunks but no live OpenRouter reader (e.g. after DO restart).
	 */
	private _finalizeOrphanedStreamFromChunks(streamId: string): void {
		if (this._activeStreamId !== streamId || !this._activeMessageId) {
			return;
		}
		const messageId = this._activeMessageId;
		const chunks = this._getStreamChunks(streamId);
		const text = chunks.join("");
		const assistantMessage: AssistantMessage = {
			id: messageId,
			role: "assistant",
			content: text.length > 0 ? text : null,
			createdAt: Date.now(),
		};
		this._completeStreamWithMessage(streamId, assistantMessage);
		this._broadcast({
			type: "messageEnd",
			id: messageId,
			createdAt: assistantMessage.createdAt,
		});
	}

	// ============================================================================
	// Abort Controller Management
	// ============================================================================

	private _getAbortSignal(id: string): AbortSignal {
		let controller = this._abortControllers.get(id);
		if (!controller) {
			controller = new AbortController();
			this._abortControllers.set(id, controller);
		}
		return controller.signal;
	}

	private _cancelRequest(id: string): void {
		const controller = this._abortControllers.get(id);
		if (controller) {
			controller.abort();
			this._abortControllers.delete(id);
		}
	}

	private _removeAbortController(id: string): void {
		this._abortControllers.delete(id);
	}

	// ============================================================================
	// Broadcasting
	// ============================================================================

	private _broadcast(msg: ServerMessage): void {
		this.broadcast(JSON.stringify(msg));
	}

	private _sendTo(connection: Connection, msg: ServerMessage): void {
		connection.send(JSON.stringify(msg));
	}

	private _enqueueTurn(fn: () => Promise<void>): Promise<void> {
		const run = this._turnTail.then(fn);
		this._turnTail = run.then(
			() => {},
			() => {},
		);
		return run;
	}

	private _resolveToolApproval(approvalId: string, approved: boolean): void {
		const pending = this._pendingToolApprovals.get(approvalId);
		if (!pending) {
			return;
		}
		this._pendingToolApprovals.delete(approvalId);
		pending.resolve(approved);
	}

	private _mergeProviderMetadata(
		a: Record<string, unknown> | undefined,
		b: Record<string, unknown> | undefined,
	): Record<string, unknown> | undefined {
		if (!a && !b) {
			return undefined;
		}
		return { ...(a ?? {}), ...(b ?? {}) };
	}

	private _replaceMessagesFromClient(
		messages: ReadonlyArray<ChatMessage>,
	): void {
		this.resetTurnState();
		this._flushChunkBuffer();
		if (this._activeStreamId) {
			this.dbDeleteStreamWithChunks(this._activeStreamId);
		}
		this._activeStreamId = null;
		this._activeMessageId = null;
		this._streamChunkIndex = 0;
		this._chunkBuffer = [];
		this.dbReplaceAllMessages([...messages]);
		this.messages = [...messages];
	}

	// ============================================================================
	// OpenRouter Integration
	// ============================================================================

	private _getOpenRouter(): OpenRouter {
		// Use AI Gateway if configured, otherwise use OpenRouter directly
		const envWithGateway = this.env as Env & {
			CLOUDFLARE_ACCOUNT_ID?: string;
			AI_GATEWAY_NAME?: string;
			AI_GATEWAY_TOKEN?: string;
		};

		const serverURL =
			envWithGateway.CLOUDFLARE_ACCOUNT_ID && envWithGateway.AI_GATEWAY_NAME
				? `https://gateway.ai.cloudflare.com/v1/${envWithGateway.CLOUDFLARE_ACCOUNT_ID}/${envWithGateway.AI_GATEWAY_NAME}/openrouter`
				: undefined;

		return new OpenRouter({
			apiKey: this.env.OPENROUTER_API_KEY,
			...(serverURL && { serverURL }),
		});
	}

	// ============================================================================
	// WebSocket Handlers
	// ============================================================================

	async onConnect(connection: Connection, _ctx: ConnectionContext) {
		this._sendTo(connection, { type: "history", messages: this.messages });
	}

	async onClose(
		connection: Connection,
		_code: number,
		_reason: string,
		_wasClean: boolean,
	): Promise<void> {
		if (this._continuationOriginConnectionId === connection.id) {
			this._continuationOriginConnectionId = null;
		}
	}

	async onMessage(connection: Connection, message: string) {
		const data = safeParseClientMessage(message);

		if (!data) {
			console.error("Invalid client message:", message);
			this._sendTo(connection, {
				type: "error",
				message: "Invalid message format",
			});
			return;
		}

		try {
			switch (data.type) {
				case "getHistory":
					this._sendTo(connection, {
						type: "history",
						messages: this.messages,
					});
					break;

				case "clearHistory":
					await this._enqueueTurn(async () => {
						this._clearMessages();
						this._broadcast({ type: "history", messages: [] });
					});
					break;

				case "sendMessage":
					await this._enqueueTurn(async () => {
						this._continuationOriginConnectionId = connection.id;
						await this._handleSendMessagePayload(data);
					});
					break;

				case "toolApprovalResponse":
					this._resolveToolApproval(data.approvalId, data.approved);
					break;

				case "resumeStream":
					this._handleResumeStream(data.streamId);
					break;

				case "cancelRequest":
					this._cancelRequest(data.id);
					break;

				case "toolResult":
					await this._handleToolResultMessage(
						connection,
						data.toolCallId,
						data.toolName,
						data.output,
						data.autoContinue ?? false,
					);
					break;

				case "registerTools":
					await this._enqueueTurn(async () => {
						this._registerClientTools(
							connection,
							data.tools as ReadonlyArray<{
								name: string;
								description?: string;
								parameters?: Record<string, unknown>;
							}>,
						);
					});
					break;
				default:
					exhaustiveGuard(data);
			}
		} catch (err) {
			console.error("Error processing message:", err);
			this._broadcast({
				type: "error",
				message: "Failed to process message",
			});
		}
	}

	// ============================================================================
	// Chat Message Handling
	// ============================================================================

	/**
	 * Get the system prompt for the AI
	 * Override this method to customize the AI's behavior
	 */
	protected getSystemPrompt(): string {
		return DEFAULT_SYSTEM_PROMPT;
	}

	/**
	 * Get the AI model to use
	 * Override this method to use a different model
	 */
	protected getModel(): string {
		return "anthropic/claude-sonnet-4.5";
	}

	/**
	 * Get available tools for the AI
	 * Override this method to provide custom tools
	 */
	protected getTools(): ToolDefinition[] {
		return [];
	}

	private async _handleSendMessagePayload(
		data: SendMessagePayload,
	): Promise<void> {
		const trigger = data.trigger ?? "submit-message";
		if (trigger === "regenerate-message") {
			this._replaceMessagesFromClient(data.messages ?? []);
			await this._generateAIResponse();
			return;
		}
		if (data.messages && data.messages.length > 0) {
			this._replaceMessagesFromClient(data.messages);
		}
		const content = data.content;
		if (content !== undefined && content !== "") {
			const userMessage: UserMessage = {
				id: crypto.randomUUID(),
				role: "user",
				content,
				createdAt: Date.now(),
			};
			this._persistMessage(userMessage);
			if (typeof this.maxPersistedMessages !== "number") {
				this.messages.push(userMessage);
			}
		}
		const last = this.messages[this.messages.length - 1];
		if (last?.role !== "user") {
			this._broadcast({
				type: "error",
				message:
					"Cannot generate: conversation must end with a user message (sync `messages` and/or send `content`).",
			});
			return;
		}
		await this._generateAIResponse();
	}

	private async _handleToolResultMessage(
		connection: Connection,
		toolCallId: string,
		toolName: string,
		output: unknown,
		autoContinue: boolean,
	): Promise<void> {
		if (!autoContinue) {
			await this._enqueueTurn(async () => {
				await this._applyClientToolResult(connection, toolCallId, output);
			});
			return;
		}

		this._pendingClientToolAutoContinue.push({
			connection,
			toolCallId,
			toolName,
			output,
		});
		this._scheduleClientToolAutoContinueFlush();
	}

	private _scheduleClientToolAutoContinueFlush(): void {
		if (this._clientToolAutoContinueFlushScheduled) {
			return;
		}
		this._clientToolAutoContinueFlushScheduled = true;
		queueMicrotask(() => {
			this._clientToolAutoContinueFlushScheduled = false;
			const batch = this._pendingClientToolAutoContinue.splice(0);
			if (batch.length === 0) {
				return;
			}
			void this._enqueueTurn(async () => {
				const origin = batch[0]?.connection;
				if (origin) {
					this._continuationOriginConnectionId = origin.id;
				}
				for (const item of batch) {
					await this._applyClientToolResult(
						item.connection,
						item.toolCallId,
						item.output,
					);
				}
				await this._generateAIResponse();
			});
		});
	}

	private async _applyClientToolResult(
		_connection: Connection,
		toolCallId: string,
		output: unknown,
	): Promise<void> {
		const assistantMsg = this.messages.find(
			(m) =>
				isAssistantMessage(m) &&
				m.toolCalls?.some((tc: ToolCall) => tc.id === toolCallId),
		) as AssistantMessage | undefined;

		if (!assistantMsg) {
			console.warn(
				`[ChatAgent] Tool result for unknown tool call: ${toolCallId}`,
			);
			this._broadcast({ type: "error", message: "Tool call not found" });
			return;
		}

		const toolMessage: ToolMessage = {
			id: crypto.randomUUID(),
			role: "tool",
			toolCallId,
			content: JSON.stringify(output),
			createdAt: Date.now(),
		};

		this._persistMessage(toolMessage);
		if (typeof this.maxPersistedMessages !== "number") {
			this.messages.push(toolMessage);
		}
		this._broadcast({ type: "messageUpdated", message: toolMessage });
	}

	/**
	 * Generate AI response (can be called for initial message or after tool results)
	 */
	private async _generateAIResponse(): Promise<void> {
		const generation = this._turnGeneration;
		const assistantId = crypto.randomUUID();
		const streamId = this._startStream(assistantId);
		const abortSignal = this._getAbortSignal(assistantId);

		this._broadcast({ type: "messageStart", id: assistantId, streamId });

		const runStream = async (): Promise<void> => {
			let fullContent = "";
			let usage: TokenUsage | undefined;

			const toolCallsInProgress: Map<
				number,
				{
					id: string;
					name: string;
					arguments: string;
					providerMetadata?: Record<string, unknown>;
				}
			> = new Map();

			const openRouter = this._getOpenRouter();
			const toolsMap = this._getToolsMap();
			const tools = Array.from(toolsMap.values());
			const apiMessages = this._buildApiMessages();

			const envWithGateway = this.env as Env & { AI_GATEWAY_TOKEN?: string };
			const headers = envWithGateway.AI_GATEWAY_TOKEN
				? {
						"cf-aig-authorization": `Bearer ${envWithGateway.AI_GATEWAY_TOKEN}`,
					}
				: undefined;

			const stream = await openRouter.chat.send(
				{
					chatRequest: {
						model: this.getModel(),
						messages: apiMessages,
						stream: true,
						...(tools.length > 0 && { tools }),
					},
				},
				{
					...(headers && { headers }),
					signal: abortSignal,
				},
			);

			this._openRouterStreamLive = true;
			try {
				for await (const chunk of stream) {
					if (generation !== this._turnGeneration) {
						return;
					}
					if (abortSignal.aborted) {
						throw new Error("Request cancelled");
					}

					const delta = chunk.choices?.[0]?.delta;

					if (delta?.content) {
						fullContent += delta.content;
						this._storeChunk(streamId, delta.content);
						this._broadcast({
							type: "messageChunk",
							id: assistantId,
							chunk: delta.content,
						});
					}

					if (delta?.toolCalls) {
						for (const toolCallDelta of delta.toolCalls) {
							const index = toolCallDelta.index;

							if (!toolCallsInProgress.has(index)) {
								toolCallsInProgress.set(index, {
									id: toolCallDelta.id || "",
									name: toolCallDelta.function?.name || "",
									arguments: "",
								});
							}

							const tcRow = toolCallsInProgress.get(index);
							if (tcRow) {
								if (toolCallDelta.id) {
									tcRow.id = toolCallDelta.id;
								}
								if (toolCallDelta.function?.name) {
									tcRow.name = toolCallDelta.function.name;
								}
								if (toolCallDelta.function?.arguments) {
									tcRow.arguments += toolCallDelta.function.arguments;
								}
								const rawEntry = getRawToolCallDeltaEntry(chunk, index);
								const extra = rawEntry
									? extractProviderMetadataFromRawToolPart(rawEntry)
									: undefined;
								if (extra) {
									tcRow.providerMetadata = this._mergeProviderMetadata(
										tcRow.providerMetadata,
										extra,
									);
								}
							}

							const deltaMsg: ToolCallDelta = {
								index: toolCallDelta.index,
								id: toolCallDelta.id,
								type: toolCallDelta.type as "function" | undefined,
								function: toolCallDelta.function
									? {
											name: toolCallDelta.function.name,
											arguments: toolCallDelta.function.arguments,
										}
									: undefined,
								...(tcRow?.providerMetadata &&
									Object.keys(tcRow.providerMetadata).length > 0 && {
										providerMetadata: tcRow.providerMetadata,
									}),
							};
							this._broadcast({
								type: "toolCallDelta",
								id: assistantId,
								delta: deltaMsg,
							});
						}
					}

					if (chunk.usage) {
						usage = {
							prompt_tokens: chunk.usage.promptTokens ?? 0,
							completion_tokens: chunk.usage.completionTokens ?? 0,
							total_tokens: chunk.usage.totalTokens ?? 0,
						};
					}
				}

				const finalToolCalls: ToolCall[] = [];
				for (const [, tc] of toolCallsInProgress) {
					if (tc.id && tc.name) {
						const toolCall: ToolCall = {
							id: tc.id,
							type: "function",
							function: {
								name: tc.name,
								arguments: tc.arguments,
							},
							...(tc.providerMetadata &&
								Object.keys(tc.providerMetadata).length > 0 && {
									providerMetadata: tc.providerMetadata,
								}),
						};
						finalToolCalls.push(toolCall);

						this._broadcast({
							type: "toolCall",
							id: assistantId,
							toolCall,
						});
					}
				}

				const assistantMessage: AssistantMessage = {
					id: assistantId,
					role: "assistant",
					content: fullContent || null,
					toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined,
					createdAt: Date.now(),
				};

				this._completeStreamWithMessage(streamId, assistantMessage);
				this._removeAbortController(assistantId);

				this._broadcast({
					type: "messageEnd",
					id: assistantId,
					toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined,
					createdAt: assistantMessage.createdAt,
					...(usage && { usage }),
				});

				if (finalToolCalls.length > 0) {
					const hasServerTools =
						await this._executeServerSideTools(finalToolCalls);
					if (hasServerTools) {
						return;
					}
				}
			} catch (err) {
				console.error("OpenRouter error:", err);
				this._markStreamError(streamId);
				this._removeAbortController(assistantId);
				this._broadcast({
					type: "error",
					message:
						err instanceof Error ? err.message : "Failed to get AI response",
				});
			} finally {
				this._openRouterStreamLive = false;
			}
		};

		const streamPromise = runStream();
		this.ctx.waitUntil(streamPromise);
		await streamPromise;
	}

	/**
	 * Build API messages from our message history
	 */
	private _buildApiMessages(): OpenRouterMessage[] {
		const result: OpenRouterMessage[] = [
			{ role: "system", content: this.getSystemPrompt() } as ORSystemMessage,
		];

		for (const msg of this.messages) {
			switch (msg.role) {
				case "user":
					result.push({ role: "user", content: msg.content } as ORUserMessage);
					break;
				case "assistant": {
					const assistantMsg = msg;
					const orMsg: ORAssistantMessage = {
						role: "assistant",
						content: assistantMsg.content,
						...(assistantMsg.toolCalls && {
							toolCalls: assistantMsg.toolCalls.map((tc) => {
								const call: ORToolCall = {
									id: tc.id,
									type: "function",
									function: {
										name: tc.function.name,
										arguments: tc.function.arguments,
									},
								};
								const meta = tc.providerMetadata;
								if (meta) {
									const {
										id: _i,
										type: _t,
										function: _fn,
										...rest
									} = meta as Record<string, unknown>;
									Object.assign(call, rest);
								}
								return call;
							}),
						}),
					};
					result.push(orMsg);
					break;
				}
				case "tool": {
					const toolMsg = msg;
					result.push({
						role: "tool",
						content: toolMsg.content,
						toolCallId: toolMsg.toolCallId,
					} as ORToolMessage);
					break;
				}
				default:
					exhaustiveGuard(msg);
			}
		}

		return result;
	}

	/**
	 * Build a map of tool definitions by name for quick lookup
	 */
	private _getToolsMap(): Map<string, ToolDefinition> {
		const tools = this.getTools();
		const map = new Map(tools.map((t) => [t.function.name, t]));

		for (const [name, tool] of this._clientTools) {
			if (!map.has(name)) {
				const toolDef: ToolDefinition = {
					type: "function",
					function: {
						name: tool.name,
					},
				};
				if (tool.description !== undefined) {
					toolDef.function.description = tool.description;
				}
				if (tool.parameters !== undefined) {
					toolDef.function.parameters = tool.parameters;
				}
				map.set(name, toolDef);
			}
		}

		return map;
	}

	/**
	 * Register tools from the client at runtime
	 */
	private _registerClientTools(
		_connection: Connection,
		tools: ReadonlyArray<{
			name: string;
			description?: string;
			parameters?: Record<string, unknown>;
		}>,
	): void {
		for (const tool of tools) {
			const entry: {
				name: string;
				description?: string;
				parameters?: Record<string, unknown>;
			} = {
				name: tool.name,
			};
			if (tool.description !== undefined) {
				entry.description = tool.description;
			}
			if (tool.parameters !== undefined) {
				entry.parameters = tool.parameters;
			}
			this._clientTools.set(tool.name, entry);
			console.log(`[ChatAgent] Registered client tool: ${tool.name}`);
		}

		this._broadcast({
			type: "history",
			messages: this.messages,
		});
	}

	/**
	 * Execute server-side tools and continue the conversation
	 */
	private async _executeServerSideTools(
		toolCalls: ToolCall[],
	): Promise<boolean> {
		const toolsMap = this._getToolsMap();
		let executedServerTools = false;

		for (const toolCall of toolCalls) {
			const toolDef = toolsMap.get(toolCall.function.name);

			if (!toolDef) {
				this._broadcast({
					type: "toolError",
					errorType: "not_found",
					toolCallId: toolCall.id,
					toolName: toolCall.function.name,
					message: `Tool "${toolCall.function.name}" not found`,
				});
				continue;
			}

			if (!toolDef.execute) {
				continue;
			}

			executedServerTools = true;

			try {
				let args: Record<string, unknown>;
				try {
					args = toolCall.function.arguments
						? JSON.parse(toolCall.function.arguments)
						: {};
				} catch (parseErr) {
					this._broadcast({
						type: "toolError",
						errorType: "input",
						toolCallId: toolCall.id,
						toolName: toolCall.function.name,
						message: `Invalid JSON arguments: ${parseErr instanceof Error ? parseErr.message : "Parse error"}`,
					});
					continue;
				}

				if (toolDef.needsApproval) {
					const needApproval = await toolDef.needsApproval(args);
					if (needApproval) {
						const approvalId = crypto.randomUUID();
						const approved = await new Promise<boolean>((resolve) => {
							this._pendingToolApprovals.set(approvalId, { resolve });
							this._broadcast({
								type: "toolApprovalRequest",
								approvalId,
								toolCallId: toolCall.id,
								toolName: toolCall.function.name,
								arguments: toolCall.function.arguments,
							});
						});
						if (!approved) {
							const errorMsg = "Tool execution rejected by user";
							this._broadcast({
								type: "toolError",
								errorType: "output",
								toolCallId: toolCall.id,
								toolName: toolCall.function.name,
								message: errorMsg,
							});
							const rejectedMessage: ToolMessage = {
								id: crypto.randomUUID(),
								role: "tool",
								toolCallId: toolCall.id,
								content: JSON.stringify({
									error: errorMsg,
									rejected: true,
								}),
								createdAt: Date.now(),
							};
							this._persistMessage(rejectedMessage);
							if (typeof this.maxPersistedMessages !== "number") {
								this.messages.push(rejectedMessage);
							}
							this._broadcast({
								type: "messageUpdated",
								message: rejectedMessage,
							});
							continue;
						}
					}
				}

				console.log(
					`[ChatAgent] Executing server tool: ${toolCall.function.name}`,
					args,
				);

				const result = await toolDef.execute(args);

				const toolMessage: ToolMessage = {
					id: crypto.randomUUID(),
					role: "tool",
					toolCallId: toolCall.id,
					content: JSON.stringify(result),
					createdAt: Date.now(),
				};

				this._persistMessage(toolMessage);
				if (typeof this.maxPersistedMessages !== "number") {
					this.messages.push(toolMessage);
				}

				this._broadcast({ type: "messageUpdated", message: toolMessage });

				console.log(
					`[ChatAgent] Server tool completed: ${toolCall.function.name}`,
					result,
				);
			} catch (err) {
				console.error(
					`[ChatAgent] Server tool error: ${toolCall.function.name}`,
					err,
				);

				const errorMsg =
					err instanceof Error ? err.message : "Tool execution failed";
				this._broadcast({
					type: "toolError",
					errorType: "output",
					toolCallId: toolCall.id,
					toolName: toolCall.function.name,
					message: errorMsg,
				});

				const errorMessage: ToolMessage = {
					id: crypto.randomUUID(),
					role: "tool",
					toolCallId: toolCall.id,
					content: JSON.stringify({ error: errorMsg }),
					createdAt: Date.now(),
				};

				this._persistMessage(errorMessage);
				if (typeof this.maxPersistedMessages !== "number") {
					this.messages.push(errorMessage);
				}
				this._broadcast({
					type: "messageUpdated",
					message: errorMessage,
				});
			}
		}

		if (executedServerTools) {
			await this._generateAIResponse();
		}

		return executedServerTools;
	}

	private _handleResumeStream(streamId: string): void {
		if (!this.dbIsStreamKnown(streamId)) {
			this._broadcast({
				type: "streamResume",
				streamId,
				chunks: [],
				done: true,
			});
			return;
		}

		const chunks = this._getStreamChunks(streamId);
		const isLive =
			this._openRouterStreamLive && this._activeStreamId === streamId;

		this._broadcast({
			type: "streamResume",
			streamId,
			chunks,
			done: !isLive,
		});

		if (!isLive && this._activeStreamId === streamId) {
			this._finalizeOrphanedStreamFromChunks(streamId);
		}
	}

	// ============================================================================
	// Cleanup
	// ============================================================================

	async destroy(): Promise<void> {
		for (const controller of this._abortControllers.values()) {
			controller.abort();
		}
		this._abortControllers.clear();

		this._flushChunkBuffer();

		await super.destroy();
	}
}
