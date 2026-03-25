/**
 * @firtoz/chat-agent — wire protocol, tool helpers, and abstract `ChatAgentBase`.
 *
 * Install a persistence package separately:
 * - `@firtoz/chat-agent-drizzle` — Drizzle ORM (recommended)
 * - `@firtoz/chat-agent-sql` — raw `this.sql`
 *
 * @example
 * ```typescript
 * import { ChatAgentBase, defineTool, type ToolDefinition } from "@firtoz/chat-agent";
 * import { DrizzleChatAgent } from "@firtoz/chat-agent-drizzle";
 *
 * class MyAgent extends DrizzleChatAgent<Env> {
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

export { ChatAgentBase } from "./chat-agent-base";

export type {
	AssistantMessage,
	ChatMessage,
	UserMessage,
	ToolMessage,
	ToolCall,
	ToolCallDelta,
	ToolDefinition,
	ToolResult,
	JSONSchema,
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
	TokenUsage,
} from "./chat-messages";

export {
	defineTool,
	parseClientMessage,
	safeParseClientMessage,
	parseServerMessage,
	safeParseServerMessage,
	isClientMessage,
	isServerMessage,
	isUserMessage,
	isAssistantMessage,
	isToolMessage,
	hasToolCalls,
	parseToolArguments,
} from "./chat-messages";
