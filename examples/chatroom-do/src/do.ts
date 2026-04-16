import { SockaDoSession, type SockaDoSessionConfig, SockaWebSocketDO } from "@firtoz/socka/do";
import { desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/durable-sqlite";
import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import migrations from "../drizzle/migrations.js";
import type { ChatMessageRow } from "./contract";
import { chatContract } from "./contract";
import * as schema from "./schema";
import { chatMessagesTable } from "./schema";

type SessionData = { userId: string; displayName: string };

export class ChatSockaSession extends SockaDoSession<
	typeof chatContract,
	SessionData,
	Env
> {
	constructor(
		websocket: WebSocket,
		sessions: Map<WebSocket, ChatSockaSession>,
		config: SockaDoSessionConfig<typeof chatContract, SessionData, Env>,
	) {
		super(websocket, sessions, config);
	}
}

export class ChatRoomDO extends SockaWebSocketDO<ChatSockaSession, Env> {
	app = this.getBaseApp();

	private db!: ReturnType<typeof drizzle<typeof schema>>;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env, {
			createSockaSession: (_c, websocket) =>
				new ChatSockaSession(
					websocket,
					this.sessions as Map<WebSocket, ChatSockaSession>,
					this.buildConfig(),
				),
		});

		ctx.blockConcurrencyWhile(async () => {
			const db = drizzle(ctx.storage, { schema });
			migrate(db, migrations);
			this.db = db;
		});
	}

	private buildConfig(): SockaDoSessionConfig<typeof chatContract, SessionData, Env> {
		return {
			contract: chatContract,
			wireFormat: "json",
			createData: (ctx) => {
				const u = new URL(ctx.req.url);
				const displayName = u.searchParams.get("name")?.trim() || "anon";
				return { userId: crypto.randomUUID(), displayName };
			},
			onAttached: async (session) => {
				await session.broadcastPush(
					"userJoined",
					{
						userId: session.data.userId,
						displayName: session.data.displayName,
					},
					true,
				);
			},
			handlers: {
				listHistory: async (input, _session) => {
					const lim = input.limit ?? 200;
					const rows = await this.db
						.select()
						.from(chatMessagesTable)
						.orderBy(desc(chatMessagesTable.ts))
						.limit(lim);
					const messages: ChatMessageRow[] = rows.reverse().map((r) => ({
						id: r.id,
						ts: r.ts,
						userId: r.userId,
						displayName: r.displayName,
						text: r.text,
					}));
					return { messages };
				},
				listPresence: async (_input, session) => {
					const users = session
						.listPeers()
						.map((d) => ({ userId: d.userId, displayName: d.displayName }));
					users.sort((a, b) => a.displayName.localeCompare(b.displayName));
					return { selfUserId: session.data.userId, users };
				},
				sendMessage: async (input, session) => {
					const row: ChatMessageRow = {
						id: crypto.randomUUID(),
						ts: Date.now(),
						userId: session.data.userId,
						displayName: session.data.displayName,
						text: input.text,
					};
					await this.db.insert(chatMessagesTable).values({
						id: row.id,
						ts: row.ts,
						userId: row.userId,
						displayName: row.displayName,
						text: row.text,
					});
					await session.broadcastPush("roomMessage", row);
					return { ok: true as const };
				},
				clearHistory: async (_input, session) => {
					await this.db.delete(chatMessagesTable);
					const ts = Date.now();
					await session.broadcastPush("historyCleared", {
						ts,
						clearedByUserId: session.data.userId,
						clearedByDisplayName: session.data.displayName,
					});
					return { ok: true as const };
				},
			},
			handleClose: async (session) => {
				await session.broadcastPush(
					"userLeft",
					{ userId: session.data.userId, displayName: session.data.displayName },
					true,
				);
			},
		};
	}
}
