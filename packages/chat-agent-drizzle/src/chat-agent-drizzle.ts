import { and, asc, count, desc, eq, lt } from "drizzle-orm";
import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import type { ChatMessage } from "@firtoz/chat-agent";
import { ChatAgentBase } from "@firtoz/chat-agent";
import { createDb, type Database } from "./db/index";
import {
	messagesTable,
	type NewMessage,
	streamChunksTable,
	streamMetadataTable,
} from "./db/schema";
import migrations from "../drizzle/migrations.js";

/**
 * ChatAgent implementation using Drizzle ORM
 *
 * Uses Drizzle's type-safe query builder for database operations.
 */
export class DrizzleChatAgent<
	Env extends Cloudflare.Env & {
		OPENROUTER_API_KEY: string;
	} = Cloudflare.Env & { OPENROUTER_API_KEY: string },
> extends ChatAgentBase<Env> {
	private db!: Database;

	// ============================================================================
	// Database Implementation - Drizzle ORM
	// ============================================================================

	protected dbInitialize(): void {
		// Initialize Drizzle DB
		this.db = createDb(this.ctx.storage);

		// Run migrations
		migrate(this.db, migrations);
	}

	protected dbLoadMessages(): ChatMessage[] {
		const rows = this.db
			.select()
			.from(messagesTable)
			.orderBy(asc(messagesTable.createdAt))
			.all();

		return rows
			.map((row) => {
				try {
					return JSON.parse(row.messageJson) as ChatMessage;
				} catch (err) {
					console.error(`Failed to parse message ${row.id}:`, err);
					return null;
				}
			})
			.filter((msg): msg is ChatMessage => msg !== null);
	}

	protected dbSaveMessage(msg: ChatMessage): void {
		const newMsg: NewMessage = {
			id: msg.id,
			role: msg.role,
			messageJson: JSON.stringify(msg),
			createdAt: new Date(msg.createdAt),
		};

		this.db
			.insert(messagesTable)
			.values(newMsg)
			.onConflictDoUpdate({
				target: messagesTable.id,
				set: { messageJson: newMsg.messageJson },
			})
			.run();
	}

	protected dbClearAll(): void {
		this.db.delete(messagesTable).run();
		this.db.delete(streamChunksTable).run();
		this.db.delete(streamMetadataTable).run();
	}

	protected dbFindActiveStream(): {
		id: string;
		messageId: string;
		createdAt: Date;
	} | null {
		const activeStreams = this.db
			.select()
			.from(streamMetadataTable)
			.where(eq(streamMetadataTable.status, "streaming"))
			.orderBy(asc(streamMetadataTable.createdAt))
			.limit(1)
			.all();

		if (activeStreams.length === 0) {
			return null;
		}

		const stream = activeStreams[0];
		return {
			id: stream.id,
			messageId: stream.messageId,
			createdAt: stream.createdAt,
		};
	}

	protected dbDeleteStreamWithChunks(streamId: string): void {
		this.db
			.delete(streamChunksTable)
			.where(eq(streamChunksTable.streamId, streamId))
			.run();
		this.db
			.delete(streamMetadataTable)
			.where(eq(streamMetadataTable.id, streamId))
			.run();
	}

	protected dbInsertStreamMetadata(streamId: string, messageId: string): void {
		this.db
			.insert(streamMetadataTable)
			.values({
				id: streamId,
				messageId,
				status: "streaming",
				createdAt: new Date(),
			})
			.run();
	}

	protected dbUpdateStreamStatus(
		streamId: string,
		status: "completed" | "error",
	): void {
		this.db
			.update(streamMetadataTable)
			.set({ status, completedAt: new Date() })
			.where(eq(streamMetadataTable.id, streamId))
			.run();
	}

	protected dbDeleteOldCompletedStreams(cutoffMs: number): void {
		const cutoff = new Date(cutoffMs);

		// Delete old stream chunks for completed streams
		const oldStreams = this.db
			.select({ id: streamMetadataTable.id })
			.from(streamMetadataTable)
			.where(
				and(
					eq(streamMetadataTable.status, "completed"),
					lt(streamMetadataTable.completedAt, cutoff),
				),
			)
			.all();

		for (const stream of oldStreams) {
			this.db
				.delete(streamChunksTable)
				.where(eq(streamChunksTable.streamId, stream.id))
				.run();
		}

		// Delete old stream metadata
		this.db
			.delete(streamMetadataTable)
			.where(
				and(
					eq(streamMetadataTable.status, "completed"),
					lt(streamMetadataTable.completedAt, cutoff),
				),
			)
			.run();
	}

	protected dbFindMaxChunkIndex(streamId: string): number | null {
		const row = this.db
			.select({ maxIndex: streamChunksTable.chunkIndex })
			.from(streamChunksTable)
			.where(eq(streamChunksTable.streamId, streamId))
			.orderBy(desc(streamChunksTable.chunkIndex))
			.limit(1)
			.all()[0];
		return row?.maxIndex ?? null;
	}

	protected dbIsStreamKnown(streamId: string): boolean {
		const meta = this.db
			.select({ id: streamMetadataTable.id })
			.from(streamMetadataTable)
			.where(eq(streamMetadataTable.id, streamId))
			.limit(1)
			.all();
		if (meta.length > 0) {
			return true;
		}
		const chunk = this.db
			.select({ id: streamChunksTable.id })
			.from(streamChunksTable)
			.where(eq(streamChunksTable.streamId, streamId))
			.limit(1)
			.all();
		return chunk.length > 0;
	}

	protected dbReplaceAllMessages(messages: ChatMessage[]): void {
		this.db.delete(messagesTable).run();
		for (const msg of messages) {
			const newMsg: NewMessage = {
				id: msg.id,
				role: msg.role,
				messageJson: JSON.stringify(msg),
				createdAt: new Date(msg.createdAt),
			};
			this.db.insert(messagesTable).values(newMsg).run();
		}
	}

	protected dbTrimMessagesToMax(maxMessages: number): void {
		const [{ n }] = this.db.select({ n: count() }).from(messagesTable).all();
		const total = Number(n);
		if (total <= maxMessages) {
			return;
		}
		const toRemove = total - maxMessages;
		const oldest = this.db
			.select({ id: messagesTable.id })
			.from(messagesTable)
			.orderBy(asc(messagesTable.createdAt))
			.limit(toRemove)
			.all();
		for (const row of oldest) {
			this.db.delete(messagesTable).where(eq(messagesTable.id, row.id)).run();
		}
	}

	protected dbInsertChunks(
		chunks: Array<{
			id: string;
			streamId: string;
			content: string;
			chunkIndex: number;
		}>,
	): void {
		const now = new Date();
		for (const chunk of chunks) {
			this.db
				.insert(streamChunksTable)
				.values({
					id: chunk.id,
					streamId: chunk.streamId,
					content: chunk.content,
					chunkIndex: chunk.chunkIndex,
					createdAt: now,
				})
				.run();
		}
	}

	protected dbGetChunks(streamId: string): string[] {
		const rows = this.db
			.select()
			.from(streamChunksTable)
			.where(eq(streamChunksTable.streamId, streamId))
			.orderBy(asc(streamChunksTable.chunkIndex))
			.all();

		return rows.map((r) => r.content);
	}

	protected dbDeleteChunks(streamId: string): void {
		this.db
			.delete(streamChunksTable)
			.where(eq(streamChunksTable.streamId, streamId))
			.run();
	}
}
