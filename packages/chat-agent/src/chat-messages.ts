import * as z from "zod/v4";

// ============================================================================
// Tool Definitions (for sending to OpenRouter)
// ============================================================================

/**
 * JSON Schema for tool parameters (subset of JSON Schema 7)
 */
export const JSONSchemaSchema = z.record(z.string(), z.unknown());

export type JSONSchema = z.infer<typeof JSONSchemaSchema>;

/**
 * Tool definition following OpenAI/OpenRouter format
 * The schema is for wire format (no execute function)
 */
export const ToolDefinitionSchema = z.object({
	type: z.literal("function"),
	function: z.object({
		name: z.string(),
		description: z.string().optional(),
		parameters: JSONSchemaSchema.optional(),
		strict: z.boolean().optional(),
	}),
});

/**
 * Execute function signature for server-side tools
 * Takes parsed arguments, returns JSON-serializable result
 */
// biome-ignore lint/suspicious/noExplicitAny: Tool execute functions need flexible typing
export type ToolExecuteFunction = (args: any) => unknown | Promise<unknown>;

/**
 * Tool definition with optional execute function for server-side execution
 * - If `execute` is provided: server runs it automatically and continues
 * - If `execute` is omitted: tool call is sent to client for execution
 */
export type ToolNeedsApprovalFn = (
	args: Record<string, unknown>,
) => boolean | Promise<boolean>;

export type ToolDefinition = z.infer<typeof ToolDefinitionSchema> & {
	/** Optional server-side execute function. If omitted, tool call goes to client. */
	execute?: ToolExecuteFunction;
	/**
	 * When `execute` is set, if this returns true the server waits for a client
	 * `toolApprovalResponse` before running `execute` (human-in-the-loop).
	 */
	needsApproval?: ToolNeedsApprovalFn;
};

// ============================================================================
// Tool Calls (from AI responses)
// ============================================================================

/**
 * A tool call from the AI (complete, after streaming)
 */
export const ToolCallSchema = z.object({
	id: z.string(),
	type: z.literal("function"),
	function: z.object({
		name: z.string(),
		arguments: z.string(), // JSON string
	}),
	/**
	 * Opaque provider-specific fields from the upstream stream (e.g. Gemini / Anthropic extras).
	 * Forwarded on the wire when calling the model again after tool results.
	 */
	providerMetadata: z.record(z.string(), z.unknown()).optional(),
});

export type ToolCall = z.infer<typeof ToolCallSchema>;

/**
 * Tool call delta during streaming
 */
export const ToolCallDeltaSchema = z.object({
	index: z.number(),
	id: z.string().optional(),
	type: z.literal("function").optional(),
	function: z
		.object({
			name: z.string().optional(),
			arguments: z.string().optional(),
		})
		.optional(),
	providerMetadata: z.record(z.string(), z.unknown()).optional(),
});

export type ToolCallDelta = z.infer<typeof ToolCallDeltaSchema>;

// ============================================================================
// Tool Results (from client execution)
// ============================================================================

/**
 * Tool result from client-side execution
 */
export const ToolResultSchema = z.object({
	toolCallId: z.string(),
	output: z.unknown(), // Can be any JSON-serializable value
});

export type ToolResult = z.infer<typeof ToolResultSchema>;

// ============================================================================
// Chat Message Schema (supports text + tool calls)
// ============================================================================

/**
 * User message
 */
export const UserMessageSchema = z.object({
	id: z.string(),
	role: z.literal("user"),
	content: z.string(),
	createdAt: z.number(),
});

export type UserMessage = z.infer<typeof UserMessageSchema>;

/**
 * Assistant message - can have content, tool calls, or both
 */
export const AssistantMessageSchema = z.object({
	id: z.string(),
	role: z.literal("assistant"),
	content: z.string().nullable(), // null when only tool calls
	toolCalls: z.array(ToolCallSchema).optional(),
	createdAt: z.number(),
});

export type AssistantMessage = z.infer<typeof AssistantMessageSchema>;

/**
 * Tool response message (sent back to AI after tool execution)
 */
export const ToolMessageSchema = z.object({
	id: z.string(),
	role: z.literal("tool"),
	toolCallId: z.string(),
	content: z.string(), // JSON stringified result
	createdAt: z.number(),
});

export type ToolMessage = z.infer<typeof ToolMessageSchema>;

/**
 * Union of all chat message types
 */
export const ChatMessageSchema = z.discriminatedUnion("role", [
	UserMessageSchema,
	AssistantMessageSchema,
	ToolMessageSchema,
]);

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

// ============================================================================
// Token Usage Schema
// ============================================================================

export const TokenUsageSchema = z.object({
	prompt_tokens: z.number(),
	completion_tokens: z.number(),
	total_tokens: z.number(),
});

export type TokenUsage = z.infer<typeof TokenUsageSchema>;

// ============================================================================
// Client → Server Messages (Discriminated Union)
// ============================================================================

export const SendMessageTriggerSchema = z.enum([
	"submit-message",
	"regenerate-message",
]);

export type SendMessageTrigger = z.infer<typeof SendMessageTriggerSchema>;

export const ClientMessageSchema = z.discriminatedUnion("type", [
	z
		.object({
			type: z.literal("sendMessage"),
			content: z.string().optional(),
			/** Full conversation snapshot; used with `regenerate-message` or to reconcile before a new user turn */
			messages: z.array(ChatMessageSchema).optional(),
			trigger: SendMessageTriggerSchema.optional(),
		})
		.superRefine((data, ctx) => {
			const trigger = data.trigger ?? "submit-message";
			if (trigger === "regenerate-message") {
				if (!data.messages || data.messages.length === 0) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message:
							"sendMessage with trigger regenerate-message requires non-empty messages",
					});
				}
			} else {
				const hasContent = data.content !== undefined && data.content !== "";
				const messagesEndWithUser =
					!!data.messages &&
					data.messages.length > 0 &&
					data.messages[data.messages.length - 1].role === "user";
				if (!hasContent && !messagesEndWithUser) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message:
							"sendMessage requires non-empty content, or messages ending with a user message",
					});
				}
			}
		}),
	z.object({
		type: z.literal("clearHistory"),
	}),
	z.object({
		type: z.literal("getHistory"),
	}),
	z.object({
		type: z.literal("resumeStream"),
		streamId: z.string(),
	}),
	z.object({
		type: z.literal("cancelRequest"),
		id: z.string(),
	}),
	// Tool result from client-side tool execution
	z.object({
		type: z.literal("toolResult"),
		toolCallId: z.string(),
		toolName: z.string(),
		output: z.unknown(),
		// If true, server should continue the conversation after tool result
		autoContinue: z.boolean().optional(),
	}),
	z.object({
		type: z.literal("toolApprovalResponse"),
		approvalId: z.string(),
		approved: z.boolean(),
	}),
	// Register client-defined tools at runtime
	z.object({
		type: z.literal("registerTools"),
		tools: z.array(
			z.object({
				name: z.string(),
				description: z.string().optional(),
				parameters: JSONSchemaSchema.optional(),
			}),
		),
	}),
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// Individual message types for convenience
export type SendMessagePayload = Extract<
	ClientMessage,
	{ type: "sendMessage" }
>;
export type ClearHistoryPayload = Extract<
	ClientMessage,
	{ type: "clearHistory" }
>;
export type GetHistoryPayload = Extract<ClientMessage, { type: "getHistory" }>;
export type ResumeStreamPayload = Extract<
	ClientMessage,
	{ type: "resumeStream" }
>;
export type CancelRequestPayload = Extract<
	ClientMessage,
	{ type: "cancelRequest" }
>;
export type ToolResultPayload = Extract<ClientMessage, { type: "toolResult" }>;
export type ToolApprovalResponsePayload = Extract<
	ClientMessage,
	{ type: "toolApprovalResponse" }
>;
export type RegisterToolsPayload = Extract<
	ClientMessage,
	{ type: "registerTools" }
>;

// ============================================================================
// Server → Client Messages (Discriminated Union)
// ============================================================================

export const ServerMessageSchema = z.discriminatedUnion("type", [
	// Full message history
	z.object({
		type: z.literal("history"),
		messages: z.array(ChatMessageSchema),
	}),
	// Stream start
	z.object({
		type: z.literal("messageStart"),
		id: z.string(),
		streamId: z.string(),
	}),
	// Text content chunk
	z.object({
		type: z.literal("messageChunk"),
		id: z.string(),
		chunk: z.string(),
	}),
	// Tool call streaming delta
	z.object({
		type: z.literal("toolCallDelta"),
		id: z.string(),
		delta: ToolCallDeltaSchema,
	}),
	// Tool call complete (full tool call ready for execution)
	z.object({
		type: z.literal("toolCall"),
		id: z.string(), // message id
		toolCall: ToolCallSchema,
	}),
	// Stream end
	z.object({
		type: z.literal("messageEnd"),
		id: z.string(),
		// Final message state (with tool calls if any)
		toolCalls: z.array(ToolCallSchema).optional(),
		createdAt: z.number(),
		usage: TokenUsageSchema.optional(),
	}),
	// Stream resumption
	z.object({
		type: z.literal("streamResume"),
		streamId: z.string(),
		chunks: z.array(z.string()),
		done: z.boolean(),
	}),
	z.object({
		type: z.literal("streamResuming"),
		id: z.string(),
		streamId: z.string(),
	}),
	// Message updated (e.g., tool result applied)
	z.object({
		type: z.literal("messageUpdated"),
		message: ChatMessageSchema,
	}),
	// General error
	z.object({
		type: z.literal("error"),
		message: z.string(),
	}),
	// Tool input error (arguments validation failed)
	z.object({
		type: z.literal("toolError"),
		errorType: z.enum(["input", "output", "not_found"]),
		toolCallId: z.string(),
		toolName: z.string(),
		message: z.string(),
	}),
	z.object({
		type: z.literal("toolApprovalRequest"),
		approvalId: z.string(),
		toolCallId: z.string(),
		toolName: z.string(),
		arguments: z.string(),
	}),
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;

// Individual message types for convenience
export type HistoryMessage = Extract<ServerMessage, { type: "history" }>;
export type MessageStartMessage = Extract<
	ServerMessage,
	{ type: "messageStart" }
>;
export type MessageChunkMessage = Extract<
	ServerMessage,
	{ type: "messageChunk" }
>;
export type ToolCallDeltaMessage = Extract<
	ServerMessage,
	{ type: "toolCallDelta" }
>;
export type ToolCallMessage = Extract<ServerMessage, { type: "toolCall" }>;
export type MessageEndMessage = Extract<ServerMessage, { type: "messageEnd" }>;
export type StreamResumeMessage = Extract<
	ServerMessage,
	{ type: "streamResume" }
>;
export type StreamResumingMessage = Extract<
	ServerMessage,
	{ type: "streamResuming" }
>;
export type MessageUpdatedMessage = Extract<
	ServerMessage,
	{ type: "messageUpdated" }
>;
export type ErrorMessage = Extract<ServerMessage, { type: "error" }>;
export type ToolErrorMessage = Extract<ServerMessage, { type: "toolError" }>;
export type ToolApprovalRequestMessage = Extract<
	ServerMessage,
	{ type: "toolApprovalRequest" }
>;

// ============================================================================
// Parsing Helpers
// ============================================================================

/**
 * Parse and validate a client message from JSON string
 * @throws ZodError if validation fails
 */
export function parseClientMessage(json: string): ClientMessage {
	const data = JSON.parse(json);
	return ClientMessageSchema.parse(data);
}

/**
 * Safely parse a client message, returning null on failure
 */
export function safeParseClientMessage(json: string): ClientMessage | null {
	try {
		const data = JSON.parse(json);
		const result = ClientMessageSchema.safeParse(data);
		return result.success ? result.data : null;
	} catch {
		return null;
	}
}

/**
 * Parse and validate a server message from JSON string
 * @throws ZodError if validation fails
 */
export function parseServerMessage(json: string): ServerMessage {
	const data = JSON.parse(json);
	return ServerMessageSchema.parse(data);
}

/**
 * Safely parse a server message, returning null on failure
 */
export function safeParseServerMessage(json: string): ServerMessage | null {
	try {
		const data = JSON.parse(json);
		const result = ServerMessageSchema.safeParse(data);
		return result.success ? result.data : null;
	} catch {
		return null;
	}
}

// ============================================================================
// Type Guards
// ============================================================================

export function isClientMessage(data: unknown): data is ClientMessage {
	return ClientMessageSchema.safeParse(data).success;
}

export function isServerMessage(data: unknown): data is ServerMessage {
	return ServerMessageSchema.safeParse(data).success;
}

export function isUserMessage(msg: ChatMessage): msg is UserMessage {
	return msg.role === "user";
}

export function isAssistantMessage(msg: ChatMessage): msg is AssistantMessage {
	return msg.role === "assistant";
}

export function isToolMessage(msg: ChatMessage): msg is ToolMessage {
	return msg.role === "tool";
}

export function hasToolCalls(msg: AssistantMessage): boolean {
	return !!msg.toolCalls && msg.toolCalls.length > 0;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse tool call arguments from JSON string
 */
export function parseToolArguments<T = unknown>(toolCall: ToolCall): T {
	return JSON.parse(toolCall.function.arguments) as T;
}

/**
 * Create a tool definition helper
 *
 * @example Server-side tool (executes automatically on server)
 * ```ts
 * defineTool({
 *   name: "get_weather",
 *   description: "Get current weather",
 *   parameters: { type: "object", properties: { location: { type: "string" } } },
 *   execute: async (args) => {
 *     const weather = await fetchWeather(args.location);
 *     return { temp: weather.temp, conditions: weather.desc };
 *   }
 * })
 * ```
 *
 * @example Client-side tool (sent to client for execution)
 * ```ts
 * defineTool({
 *   name: "get_user_location",
 *   description: "Get user's current location",
 *   parameters: { type: "object", properties: {} },
 *   // No execute function - client handles this
 * })
 * ```
 */
export function defineTool(config: {
	name: string;
	description?: string;
	parameters?: JSONSchema;
	strict?: boolean;
	/** Server-side execute function. If omitted, tool call goes to client. */
	execute?: ToolExecuteFunction;
	/** If set with `execute`, client must approve before the server runs `execute`. */
	needsApproval?: ToolNeedsApprovalFn;
}): ToolDefinition {
	const tool: ToolDefinition = {
		type: "function",
		function: {
			name: config.name,
			description: config.description,
			parameters: config.parameters,
			strict: config.strict,
		},
	};
	if (config.execute) {
		tool.execute = config.execute;
	}
	if (config.needsApproval) {
		tool.needsApproval = config.needsApproval;
	}
	return tool;
}
