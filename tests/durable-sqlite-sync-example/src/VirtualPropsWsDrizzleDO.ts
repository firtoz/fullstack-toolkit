import { ZodWebSocketDO } from "@firtoz/websocket-do";
import { asc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/durable-sqlite";
import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import migrations from "../drizzle/migrations.js";
import * as schema from "./schema";
import type { VpMessage, VpWsClientMsg, VpWsServerMsg } from "./vp-ws-protocol";
import {
	VirtualPropsWsZodSession,
	vpWsZodSessionOptions,
} from "./vp-ws-zod-session";

const { virtualPropsMessagesTable } = schema;

export class VirtualPropsWsDrizzleDO extends ZodWebSocketDO<
	VirtualPropsWsZodSession,
	VpWsClientMsg,
	VpWsServerMsg,
	Env
> {
	app = this.getBaseApp();

	private db!: ReturnType<typeof drizzle<typeof schema>>;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env, {
			zodSessionOptions: vpWsZodSessionOptions(),
			createZodSession: (_ctx, websocket, options) =>
				new VirtualPropsWsZodSession(websocket, this.sessions, options, {
					listMessages: async () => {
						const rows = await this.db
							.select()
							.from(virtualPropsMessagesTable)
							.orderBy(asc(sql`rowid`));
						return rows.map((r) => ({
							id: r.id,
							threadId: r.threadId,
							body: r.body,
						}));
					},
					insertMessage: async (m: VpMessage) => {
						await this.db.insert(virtualPropsMessagesTable).values({
							id: m.id,
							threadId: m.threadId,
							body: m.body,
						});
					},
				}),
		});

		ctx.blockConcurrencyWhile(async () => {
			const db = drizzle(ctx.storage, { schema });
			migrate(db, migrations);
			this.db = db;

			const existing = await db
				.select()
				.from(virtualPropsMessagesTable)
				.where(eq(virtualPropsMessagesTable.id, "m1"))
				.limit(1);
			if (existing.length === 0) {
				await db.insert(virtualPropsMessagesTable).values({
					id: "m1",
					threadId: "t1",
					body: "Seed message (synced)",
				});
			}
		});
	}
}
