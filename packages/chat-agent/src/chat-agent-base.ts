import { exhaustiveGuard } from "@firtoz/maybe-error";
import { OpenRouter } from "@openrouter/sdk";

// OpenRouter SDK message types (simplified for our use)
type ORToolCall = {
	id: string;
	type: "function";
	function: { name: string; arguments: string };
};

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

// ============================================================================
// ChatAgent Class
// ============================================================================

/**
 * ChatAgentBase - Abstract base class for AI chat agents
 *
 * Features:
 * - DB-agnostic SQLite persistence in Durable Objects
 * - Resumable streaming with chunk buffering (like @cloudflare/ai-chat)
 * - OpenRouter via Cloudflare AI Gateway
 * - Constructor-based initialization pattern
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

	/** Map of message IDs to AbortControllers for request cancellation */
	private _abortControllers: Map<string, AbortController> = new Map();

	/** Currently active stream ID */
	private _activeStreamId: string | null = null;
	/** Message ID being streamed */
	private _activeMessageId: string | null = null;
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

	// ============================================================================
	// Constructor - Following @cloudflare/ai-chat pattern
	// ============================================================================

	constructor(ctx: AgentContext, env: Env) {
		super(ctx, env);

		// Initialize database (subclass-specific)
		this.dbInitialize();

		// Load messages from DB
		this.messages = this.dbLoadMessages();

		// Restore any active stream from a previous session
		this._restoreActiveStream();

		// Wrap onConnect to handle stream resumption
		const _onConnect = this.onConnect.bind(this);
		this.onConnect = async (
			connection: Connection,
			connCtx: ConnectionContext,
		) => {
			// Notify client about active streams that can be resumed
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

	// ============================================================================
	// Message Persistence
	// ============================================================================

	private _saveMessage(msg: ChatMessage): void {
		this.dbSaveMessage(msg);
	}

	private _clearMessages(): void {
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

		connection.send(
			JSON.stringify({
				type: "streamResuming",
				id: this._activeMessageId,
				streamId: this._activeStreamId,
			}),
		);
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
		this._saveMessage(message);
		this.messages.push(message);

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
		// Send history to client
		this.send(connection, { type: "history", messages: this.messages });
	}

	async onMessage(connection: Connection, message: string) {
		const data = safeParseClientMessage(message);

		if (!data) {
			console.error("Invalid client message:", message);
			this.send(connection, {
				type: "error",
				message: "Invalid message format",
			});
			return;
		}

		try {
			switch (data.type) {
				case "getHistory":
					this.send(connection, { type: "history", messages: this.messages });
					break;

				case "clearHistory":
					this._clearMessages();
					this.send(connection, { type: "history", messages: [] });
					break;

				case "sendMessage":
					await this._handleChatMessage(connection, data.content);
					break;

				case "resumeStream":
					this._handleResumeStream(connection, data.streamId);
					break;

				case "cancelRequest":
					this._cancelRequest(data.id);
					break;

				case "toolResult":
					await this._handleToolResult(
						connection,
						data.toolCallId,
						data.toolName,
						data.output,
						data.autoContinue ?? false,
					);
					break;

				case "registerTools":
					// Cast needed due to Zod's type inference with exactOptionalPropertyTypes
					this._registerClientTools(
						connection,
						data.tools as ReadonlyArray<{
							name: string;
							description?: string;
							parameters?: Record<string, unknown>;
						}>,
					);
					break;
				default:
					exhaustiveGuard(data);
			}
		} catch (err) {
			console.error("Error processing message:", err);
			this.send(connection, {
				type: "error",
				message: "Failed to process message",
			});
		}
	}

	private send(connection: Connection, msg: ServerMessage): void {
		connection.send(JSON.stringify(msg));
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
	 *
	 * Popular Anthropic models on OpenRouter:
	 * - anthropic/claude-opus-4.5 (most capable)
	 * - anthropic/claude-sonnet-4.5 (balanced, default)
	 * - anthropic/claude-haiku-3.5 (fastest, cheapest)
	 */
	protected getModel(): string {
		return "anthropic/claude-sonnet-4.5";
	}

	/**
	 * Get available tools for the AI
	 * Override this method to provide custom tools
	 */
	protected getTools(): ToolDefinition[] {
		// Default: no tools. Override in subclass to add tools.
		return [];
	}

	private async _handleChatMessage(
		connection: Connection,
		content: string,
	): Promise<void> {
		// Add user message
		const userMessage: UserMessage = {
			id: crypto.randomUUID(),
			role: "user",
			content,
			createdAt: Date.now(),
		};
		this._saveMessage(userMessage);
		this.messages.push(userMessage);

		// Generate AI response
		await this._generateAIResponse(connection);
	}

	/**
	 * Generate AI response (can be called for initial message or after tool results)
	 */
	private async _generateAIResponse(connection: Connection): Promise<void> {
		const assistantId = crypto.randomUUID();
		const streamId = this._startStream(assistantId);
		const abortSignal = this._getAbortSignal(assistantId);

		this.send(connection, { type: "messageStart", id: assistantId, streamId });

		try {
			const openRouter = this._getOpenRouter();
			// Get all tools (server-defined + client-registered)
			const toolsMap = this._getToolsMap();
			const tools = Array.from(toolsMap.values());

			// Build messages for API (convert our format to OpenRouter format)
			const apiMessages = this._buildApiMessages();

			// Stream response from OpenRouter via AI Gateway
			const envWithGateway = this.env as Env & { AI_GATEWAY_TOKEN?: string };
			const headers = envWithGateway.AI_GATEWAY_TOKEN
				? {
						"cf-aig-authorization": `Bearer ${envWithGateway.AI_GATEWAY_TOKEN}`,
					}
				: undefined;

			const stream = await openRouter.chat.send(
				{
					model: this.getModel(),
					messages: apiMessages,
					stream: true,
					...(tools.length > 0 && { tools }),
				},
				{
					...(headers && { headers }),
					signal: abortSignal,
				},
			);

			let fullContent = "";
			let usage: TokenUsage | undefined;

			// Track tool calls being streamed
			const toolCallsInProgress: Map<
				number,
				{
					id: string;
					name: string;
					arguments: string;
				}
			> = new Map();

			for await (const chunk of stream) {
				if (abortSignal.aborted) {
					throw new Error("Request cancelled");
				}

				const delta = chunk.choices?.[0]?.delta;

				// Handle text content
				if (delta?.content) {
					fullContent += delta.content;
					this._storeChunk(streamId, delta.content);
					this.send(connection, {
						type: "messageChunk",
						id: assistantId,
						chunk: delta.content,
					});
				}

				// Handle tool calls
				if (delta?.toolCalls) {
					for (const toolCallDelta of delta.toolCalls) {
						const index = toolCallDelta.index;

						// Initialize or update tool call
						if (!toolCallsInProgress.has(index)) {
							toolCallsInProgress.set(index, {
								id: toolCallDelta.id || "",
								name: toolCallDelta.function?.name || "",
								arguments: "",
							});
						}

						const tc = toolCallsInProgress.get(index);
						if (tc) {
							if (toolCallDelta.id) {
								tc.id = toolCallDelta.id;
							}
							if (toolCallDelta.function?.name) {
								tc.name = toolCallDelta.function.name;
							}
							if (toolCallDelta.function?.arguments) {
								tc.arguments += toolCallDelta.function.arguments;
							}
						}

						// Send delta to client for streaming UI
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
						};
						this.send(connection, {
							type: "toolCallDelta",
							id: assistantId,
							delta: deltaMsg,
						});
					}
				}

				// Capture usage stats from final chunk
				if (chunk.usage) {
					usage = {
						prompt_tokens: chunk.usage.promptTokens ?? 0,
						completion_tokens: chunk.usage.completionTokens ?? 0,
						total_tokens: chunk.usage.totalTokens ?? 0,
					};
				}
			}

			// Build final tool calls array
			const finalToolCalls: ToolCall[] = [];
			for (const [, tc] of toolCallsInProgress as Map<
				number,
				{ id: string; name: string; arguments: string }
			>) {
				if (tc.id && tc.name) {
					const toolCall: ToolCall = {
						id: tc.id,
						type: "function",
						function: {
							name: tc.name,
							arguments: tc.arguments,
						},
					};
					finalToolCalls.push(toolCall);

					// Send complete tool call to client
					this.send(connection, {
						type: "toolCall",
						id: assistantId,
						toolCall,
					});
				}
			}

			// Create and save assistant message
			const assistantMessage: AssistantMessage = {
				id: assistantId,
				role: "assistant",
				content: fullContent || null,
				toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined,
				createdAt: Date.now(),
			};

			this._completeStreamWithMessage(streamId, assistantMessage);
			this._removeAbortController(assistantId);

			this.send(connection, {
				type: "messageEnd",
				id: assistantId,
				toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined,
				createdAt: assistantMessage.createdAt,
				...(usage && { usage }),
			});

			// Execute server-side tools if any
			if (finalToolCalls.length > 0) {
				const hasServerTools = await this._executeServerSideTools(
					connection,
					finalToolCalls,
				);
				// If we executed server tools, the conversation continues automatically
				// Client-side tools will wait for toolResult from client
				if (hasServerTools) {
					return; // Response continues from _executeServerSideTools
				}
			}
		} catch (err) {
			console.error("OpenRouter error:", err);
			this._markStreamError(streamId);
			this._removeAbortController(assistantId);
			this.send(connection, {
				type: "error",
				message:
					err instanceof Error ? err.message : "Failed to get AI response",
			});
		}
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
							toolCalls: assistantMsg.toolCalls.map((tc) => ({
								id: tc.id,
								type: "function" as const,
								function: {
									name: tc.function.name,
									arguments: tc.function.arguments,
								},
							})),
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
	 * Includes both server-defined tools and client-registered tools
	 */
	private _getToolsMap(): Map<string, ToolDefinition> {
		const tools = this.getTools();
		const map = new Map(tools.map((t) => [t.function.name, t]));

		// Add client-registered tools (no execute function - client handles them)
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
		connection: Connection,
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

		// Acknowledge registration
		this.send(connection, {
			type: "history",
			messages: this.messages,
		});
	}

	/**
	 * Execute server-side tools and continue the conversation
	 * Returns true if any server-side tools were executed
	 */
	private async _executeServerSideTools(
		connection: Connection,
		toolCalls: ToolCall[],
	): Promise<boolean> {
		const toolsMap = this._getToolsMap();
		let executedServerTools = false;

		for (const toolCall of toolCalls) {
			const toolDef = toolsMap.get(toolCall.function.name);

			// Check if tool exists
			if (!toolDef) {
				// Send tool error for unknown tool
				this.send(connection, {
					type: "toolError",
					errorType: "not_found",
					toolCallId: toolCall.id,
					toolName: toolCall.function.name,
					message: `Tool "${toolCall.function.name}" not found`,
				});
				continue;
			}

			// Skip if tool has no execute function (client-side tool)
			if (!toolDef.execute) {
				continue;
			}

			executedServerTools = true;

			try {
				// Parse arguments (handle empty arguments)
				let args: Record<string, unknown>;
				try {
					args = toolCall.function.arguments
						? JSON.parse(toolCall.function.arguments)
						: {};
				} catch (parseErr) {
					// Send input error for malformed arguments
					this.send(connection, {
						type: "toolError",
						errorType: "input",
						toolCallId: toolCall.id,
						toolName: toolCall.function.name,
						message: `Invalid JSON arguments: ${parseErr instanceof Error ? parseErr.message : "Parse error"}`,
					});
					continue;
				}

				console.log(
					`[ChatAgent] Executing server tool: ${toolCall.function.name}`,
					args,
				);

				const result = await toolDef.execute(args);

				// Create and save tool message
				const toolMessage: ToolMessage = {
					id: crypto.randomUUID(),
					role: "tool",
					toolCallId: toolCall.id,
					content: JSON.stringify(result),
					createdAt: Date.now(),
				};

				this._saveMessage(toolMessage);
				this.messages.push(toolMessage);

				// Notify clients of tool result
				this.send(connection, { type: "messageUpdated", message: toolMessage });

				console.log(
					`[ChatAgent] Server tool completed: ${toolCall.function.name}`,
					result,
				);
			} catch (err) {
				console.error(
					`[ChatAgent] Server tool error: ${toolCall.function.name}`,
					err,
				);

				// Send output error
				const errorMsg =
					err instanceof Error ? err.message : "Tool execution failed";
				this.send(connection, {
					type: "toolError",
					errorType: "output",
					toolCallId: toolCall.id,
					toolName: toolCall.function.name,
					message: errorMsg,
				});

				// Still create an error tool message so conversation can continue
				const errorMessage: ToolMessage = {
					id: crypto.randomUUID(),
					role: "tool",
					toolCallId: toolCall.id,
					content: JSON.stringify({ error: errorMsg }),
					createdAt: Date.now(),
				};

				this._saveMessage(errorMessage);
				this.messages.push(errorMessage);
				this.send(connection, {
					type: "messageUpdated",
					message: errorMessage,
				});
			}
		}

		// If we executed any server-side tools, continue the conversation
		if (executedServerTools) {
			await this._generateAIResponse(connection);
		}

		return executedServerTools;
	}

	/**
	 * Handle tool result from client
	 */
	private async _handleToolResult(
		connection: Connection,
		toolCallId: string,
		_toolName: string, // Reserved for future use (logging, validation)
		output: unknown,
		autoContinue: boolean,
	): Promise<void> {
		// Find the assistant message with this tool call
		const assistantMsg = this.messages.find(
			(m) =>
				isAssistantMessage(m) &&
				m.toolCalls?.some((tc: ToolCall) => tc.id === toolCallId),
		) as AssistantMessage | undefined;

		if (!assistantMsg) {
			console.warn(
				`[ChatAgent] Tool result for unknown tool call: ${toolCallId}`,
			);
			this.send(connection, { type: "error", message: "Tool call not found" });
			return;
		}

		// Create tool message with result
		const toolMessage: ToolMessage = {
			id: crypto.randomUUID(),
			role: "tool",
			toolCallId,
			content: JSON.stringify(output),
			createdAt: Date.now(),
		};

		this._saveMessage(toolMessage);
		this.messages.push(toolMessage);

		// Notify clients
		this.send(connection, { type: "messageUpdated", message: toolMessage });

		// If autoContinue, generate next AI response
		if (autoContinue) {
			await this._generateAIResponse(connection);
		}
	}

	private _handleResumeStream(connection: Connection, streamId: string): void {
		// Get stored chunks
		const chunks = this._getStreamChunks(streamId);

		// Check if stream is still active
		const isActive = this._activeStreamId === streamId;

		// Send all buffered chunks
		this.send(connection, {
			type: "streamResume",
			streamId,
			chunks,
			done: !isActive,
		});
	}

	// ============================================================================
	// Cleanup
	// ============================================================================

	async destroy(): Promise<void> {
		// Abort all pending requests
		for (const controller of this._abortControllers.values()) {
			controller.abort();
		}
		this._abortControllers.clear();

		// Flush remaining chunks
		this._flushChunkBuffer();

		await super.destroy();
	}
}
