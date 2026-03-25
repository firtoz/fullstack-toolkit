import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * Chat messages table
 * Stores the full conversation history for each agent session
 * Messages are stored as JSON to support complex structures (tool calls, etc.)
 */
export const messagesTable = sqliteTable("messages", {
	id: text("id").primaryKey(),
	role: text("role", { enum: ["user", "assistant", "tool"] }).notNull(),
	// JSON-serialized message data (content, toolCalls, toolCallId, etc.)
	messageJson: text("message_json").notNull(),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

/**
 * Stream chunks table for resumable streaming
 * Buffers streamed content so clients can resume mid-stream
 */
export const streamChunksTable = sqliteTable("stream_chunks", {
	id: text("id").primaryKey(),
	streamId: text("stream_id").notNull(),
	content: text("content").notNull(),
	chunkIndex: integer("chunk_index").notNull(),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

/**
 * Stream metadata table for tracking active/completed streams
 */
export const streamMetadataTable = sqliteTable("stream_metadata", {
	id: text("id").primaryKey(),
	messageId: text("message_id").notNull(), // The assistant message being streamed
	status: text("status", {
		enum: ["streaming", "completed", "error"],
	}).notNull(),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	completedAt: integer("completed_at", { mode: "timestamp_ms" }),
});

// Type exports for use in the agent
export type Message = typeof messagesTable.$inferSelect;
export type NewMessage = typeof messagesTable.$inferInsert;
export type StreamChunk = typeof streamChunksTable.$inferSelect;
export type NewStreamChunk = typeof streamChunksTable.$inferInsert;
export type StreamMeta = typeof streamMetadataTable.$inferSelect;
export type NewStreamMeta = typeof streamMetadataTable.$inferInsert;
