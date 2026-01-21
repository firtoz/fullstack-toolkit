import type { ChatMessage } from "./chat-messages";
import { ChatAgentBase } from "./chat-agent-base";

/**
 * ChatAgent implementation using raw SQL (like @cloudflare/ai-chat)
 *
 * Uses Agent's built-in `this.sql` template tag for database operations.
 */
export class SqlChatAgent<
	Env extends Cloudflare.Env & {
		OPENROUTER_API_KEY: string;
	} = Cloudflare.Env & { OPENROUTER_API_KEY: string },
> extends ChatAgentBase<Env> {
	// ============================================================================
	// Database Implementation - Raw SQL
	// ============================================================================

	protected dbInitialize(): void {
		// Create tables for chat messages and resumable streaming
		// Based on @cloudflare/ai-chat pattern from reference
		this.sql`create table if not exists cf_ai_chat_agent_messages (
			id text primary key,
			message text not null,
			created_at datetime default current_timestamp
		)`;

		this.sql`create table if not exists cf_ai_chat_stream_chunks (
			id text primary key,
			stream_id text not null,
			body text not null,
			chunk_index integer not null,
			created_at integer not null
		)`;

		this.sql`create table if not exists cf_ai_chat_stream_metadata (
			id text primary key,
			request_id text not null,
			status text not null,
			created_at integer not null,
			completed_at integer
		)`;

		this.sql`create index if not exists idx_stream_chunks_stream_id 
			on cf_ai_chat_stream_chunks(stream_id, chunk_index)`;
	}

	protected dbLoadMessages(): ChatMessage[] {
		const rows =
			(this
				.sql`select * from cf_ai_chat_agent_messages order by created_at` as Array<{
				id: string;
				message: string;
			}>) || [];

		return rows
			.map((row) => {
				try {
					return JSON.parse(row.message) as ChatMessage;
				} catch (err) {
					console.error(`Failed to parse message ${row.id}:`, err);
					return null;
				}
			})
			.filter((msg): msg is ChatMessage => msg !== null);
	}

	protected dbSaveMessage(msg: ChatMessage): void {
		const messageJson = JSON.stringify(msg);
		this.sql`
			insert into cf_ai_chat_agent_messages (id, message)
			values (${msg.id}, ${messageJson})
			on conflict(id) do update set message = excluded.message
		`;
	}

	protected dbClearAll(): void {
		this.sql`delete from cf_ai_chat_agent_messages`;
		this.sql`delete from cf_ai_chat_stream_chunks`;
		this.sql`delete from cf_ai_chat_stream_metadata`;
	}

	protected dbFindActiveStream(): {
		id: string;
		messageId: string;
		createdAt: Date;
	} | null {
		const activeStreams = this.sql`
			select * from cf_ai_chat_stream_metadata 
			where status = 'streaming' 
			order by created_at desc 
			limit 1
		` as Array<{
			id: string;
			request_id: string;
			status: string;
			created_at: number;
			completed_at: number | null;
		}>;

		if (!activeStreams || activeStreams.length === 0) {
			return null;
		}

		const stream = activeStreams[0];
		return {
			id: stream.id,
			messageId: stream.request_id,
			createdAt: new Date(stream.created_at),
		};
	}

	protected dbDeleteStreamWithChunks(streamId: string): void {
		this
			.sql`delete from cf_ai_chat_stream_chunks where stream_id = ${streamId}`;
		this.sql`delete from cf_ai_chat_stream_metadata where id = ${streamId}`;
	}

	protected dbInsertStreamMetadata(streamId: string, messageId: string): void {
		const now = Date.now();
		this.sql`
			insert into cf_ai_chat_stream_metadata (id, request_id, status, created_at)
			values (${streamId}, ${messageId}, 'streaming', ${now})
		`;
	}

	protected dbUpdateStreamStatus(
		streamId: string,
		status: "completed" | "error",
	): void {
		const now = Date.now();
		this.sql`
			update cf_ai_chat_stream_metadata 
			set status = ${status}, completed_at = ${now} 
			where id = ${streamId}
		`;
	}

	protected dbDeleteOldCompletedStreams(cutoffMs: number): void {
		// Delete old stream chunks first
		this.sql`
			delete from cf_ai_chat_stream_chunks 
			where stream_id in (
				select id from cf_ai_chat_stream_metadata 
				where status = 'completed' and completed_at < ${cutoffMs}
			)
		`;
		// Then delete the metadata
		this.sql`
			delete from cf_ai_chat_stream_metadata 
			where status = 'completed' and completed_at < ${cutoffMs}
		`;
	}

	protected dbFindMaxChunkIndex(streamId: string): number | null {
		const result = this.sql`
			select max(chunk_index) as max_index 
			from cf_ai_chat_stream_chunks 
			where stream_id = ${streamId}
		` as Array<{ max_index: number | null }>;

		if (!result || result.length === 0 || result[0].max_index == null) {
			return null;
		}

		return result[0].max_index;
	}

	protected dbInsertChunks(
		chunks: Array<{
			id: string;
			streamId: string;
			content: string;
			chunkIndex: number;
		}>,
	): void {
		const now = Date.now();
		for (const chunk of chunks) {
			this.sql`
				insert into cf_ai_chat_stream_chunks (id, stream_id, body, chunk_index, created_at)
				values (${chunk.id}, ${chunk.streamId}, ${chunk.content}, ${chunk.chunkIndex}, ${now})
			`;
		}
	}

	protected dbGetChunks(streamId: string): string[] {
		const rows = this.sql`
			select body from cf_ai_chat_stream_chunks 
			where stream_id = ${streamId} 
			order by chunk_index asc
		` as Array<{ body: string }>;

		return (rows || []).map((r) => r.body);
	}

	protected dbDeleteChunks(streamId: string): void {
		this
			.sql`delete from cf_ai_chat_stream_chunks where stream_id = ${streamId}`;
	}
}
