import { SockaError } from "@firtoz/socka/core";
import {
	SockaWebSocketDO,
	type SockaDoSessionConfigInput,
} from "@firtoz/socka/do";
import { asc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/durable-sqlite";
import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import migrations from "../drizzle/migrations.js";
import * as schema from "./schema";
import { vpContract } from "./vp-ws-protocol";
import { VP_SLOW_INSERT_DELAY_MS } from "./vp-demo-constants";

const { virtualPropsMessagesTable } = schema;

export class VirtualPropsWsDrizzleDO extends SockaWebSocketDO<
	typeof vpContract,
	Record<string, never>,
	Env
> {
	protected readonly contract = vpContract;
	app = this.getBaseApp();

	private db!: ReturnType<typeof drizzle<typeof schema>>;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);

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

	protected buildSockaSessionConfig(): SockaDoSessionConfigInput<
		typeof vpContract,
		Record<string, never>,
		Env
	> {
		return {
			handlers: {
				list: async () => {
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
				insert: async (input) => {
					const delayMs = input.slow === true ? VP_SLOW_INSERT_DELAY_MS : 0;
					if (delayMs > 0) {
						await new Promise((r) => setTimeout(r, delayMs));
					}
					try {
						await this.db.insert(virtualPropsMessagesTable).values({
							id: input.message.id,
							threadId: input.message.threadId,
							body: input.message.body,
						});
					} catch (err) {
						throw err instanceof SockaError
							? err
							: new SockaError(
									err instanceof Error ? err.message : String(err),
								);
					}
				},
			},
			handleClose: async () => {},
			onHandlerError: (err: unknown, rpcName: string) => {
				console.error(`Handler error in ${rpcName}:`, err);
			},
		};
	}
}
