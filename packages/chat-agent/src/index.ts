/**
 * @firtoz/chat-agent - ChatAgent for Cloudflare Durable Objects with OpenRouter
 *
 * A simplified alternative to @cloudflare/ai-chat's AIChatAgent that uses OpenRouter
 * directly instead of Vercel AI SDK.
 *
 * @example
 * ```typescript
 * import { ChatAgent, defineTool, type ToolDefinition } from "@firtoz/chat-agent";
 *
 * class MyAgent extends ChatAgent {
 *   protected override getSystemPrompt(): string {
 *     return "You are a helpful assistant.";
 *   }
 *
 *   protected override getModel(): string {
 *     return "anthropic/claude-sonnet-4.5";
 *   }
 *
 *   protected override getTools(): ToolDefinition[] {
 *     return [
 *       defineTool({
 *         name: "get_time",
 *         description: "Get current time",
 *         parameters: { type: "object", properties: {} },
 *         execute: async () => ({ time: new Date().toISOString() })
 *       })
 *     ];
 *   }
 * }
 * ```
 */

// Export the abstract base class
export { ChatAgentBase } from "./chat-agent-base";

// Export concrete implementations
export { DrizzleChatAgent } from "./chat-agent-drizzle";
export { SqlChatAgent } from "./chat-agent-sql";

// Alias DrizzleChatAgent as ChatAgent for convenience (Drizzle is recommended)
export { DrizzleChatAgent as ChatAgent } from "./chat-agent-drizzle";

// Re-export all types and utilities from chat-messages
export type {
	// Message types
	AssistantMessage,
	ChatMessage,
	UserMessage,
	ToolMessage,
	// Tool types
	ToolCall,
	ToolCallDelta,
	ToolDefinition,
	ToolResult,
	JSONSchema,
	// Client/Server message types
	ClientMessage,
	ServerMessage,
	SendMessagePayload,
	ClearHistoryPayload,
	GetHistoryPayload,
	ResumeStreamPayload,
	CancelRequestPayload,
	ToolResultPayload,
	RegisterToolsPayload,
	ToolApprovalResponsePayload,
	ToolApprovalRequestMessage,
	SendMessageTrigger,
	ToolNeedsApprovalFn,
	HistoryMessage,
	MessageStartMessage,
	MessageChunkMessage,
	ToolCallDeltaMessage,
	ToolCallMessage,
	MessageEndMessage,
	StreamResumeMessage,
	StreamResumingMessage,
	MessageUpdatedMessage,
	ErrorMessage,
	ToolErrorMessage,
	// Usage types
	TokenUsage,
} from "./chat-messages";

export {
	// Tool definition helper
	defineTool,
	// Parsing helpers
	parseClientMessage,
	safeParseClientMessage,
	parseServerMessage,
	safeParseServerMessage,
	// Type guards
	isClientMessage,
	isServerMessage,
	isUserMessage,
	isAssistantMessage,
	isToolMessage,
	hasToolCalls,
	// Helper functions
	parseToolArguments,
} from "./chat-messages";
