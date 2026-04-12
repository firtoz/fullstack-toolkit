import { DurableObject } from "cloudflare:workers";
import { asc, eq, sql } from "drizzle-orm";
import { zValidator } from "@hono/zod-validator";
import { drizzle } from "drizzle-orm/durable-sqlite";
import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import { Hono } from "hono";
import migrations from "../drizzle/migrations.js";
import * as schema from "./schema";
import { VP_SLOW_INSERT_DELAY_MS } from "./vp-demo-constants";
import { vpMessageSchema } from "./vp-ws-protocol";

const { virtualPropsMessagesTable } = schema;

export class VirtualPropsDrizzleDO extends DurableObject {
	private db!: ReturnType<typeof drizzle<typeof schema>>;

	private readonly app = new Hono()
		.get("/messages", async (c) => {
			const rows = await this.db
				.select()
				.from(virtualPropsMessagesTable)
				.orderBy(asc(sql`rowid`));
			return c.json(
				rows.map((r) => ({
					id: r.id,
					threadId: r.threadId,
					body: r.body,
				})),
			);
		})
		.post("/messages", zValidator("json", vpMessageSchema), async (c) => {
			const msg = c.req.valid("json");
			const url = new URL(c.req.url);
			if (url.searchParams.get("slow") === "1") {
				await new Promise((r) => setTimeout(r, VP_SLOW_INSERT_DELAY_MS));
			}
			await this.db.insert(virtualPropsMessagesTable).values({
				id: msg.id,
				threadId: msg.threadId,
				body: msg.body,
			});
			return c.json({ ok: true as const });
		})
		.notFound((c) => c.text("Not found", 404));

	constructor(ctx: DurableObjectState, _env: Env) {
		super(ctx, _env);

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

	async fetch(request: Request): Promise<Response> {
		return this.app.fetch(request);
	}
}
