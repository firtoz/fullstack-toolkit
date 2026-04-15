import { DurableObject } from "cloudflare:workers";
import {
	createCloudflareDOSQLitePersistence,
	persistedCollectionOptions,
} from "@tanstack/cloudflare-durable-objects-db-sqlite-persistence";
import { zValidator } from "@hono/zod-validator";
import { createCollection, queryOnce } from "@tanstack/db";
import { Hono } from "hono";
import { VP_SLOW_INSERT_DELAY_MS } from "./vp-demo-constants";
import { sortVpMessagesForDisplay } from "./vp-message-sort";
import { type VpMessage, vpMessageSchema } from "./vp-ws-protocol";

const VP_MESSAGES_COLLECTION_ID = "vp-messages";

export class VirtualPropsTanstackDO extends DurableObject {
	private readonly persistence = createCloudflareDOSQLitePersistence({
		storage: this.ctx.storage,
	});

	private readonly messagesCollection = createCollection(
		persistedCollectionOptions<VpMessage, string>({
			id: VP_MESSAGES_COLLECTION_ID,
			getKey: (m) => m.id,
			persistence: this.persistence,
			schemaVersion: 1,
		}),
	);

	private readonly app = new Hono()
		.get("/messages", async (c) => {
			const rows = await queryOnce((q) =>
				q.from({ m: this.messagesCollection }).select(({ m }) => ({
					id: m.id,
					threadId: m.threadId,
					body: m.body,
				})),
			);
			return c.json(sortVpMessagesForDisplay(rows));
		})
		.post("/messages", zValidator("json", vpMessageSchema), async (c) => {
			const msg = c.req.valid("json");
			const url = new URL(c.req.url);
			if (url.searchParams.get("slow") === "1") {
				await new Promise((r) => setTimeout(r, VP_SLOW_INSERT_DELAY_MS));
			}
			const tx = this.messagesCollection.insert({
				id: msg.id,
				threadId: msg.threadId,
				body: msg.body,
			});
			await tx.isPersisted.promise;
			return c.json({ ok: true as const });
		})
		.notFound((c) => c.text("Not found", 404));

	constructor(ctx: DurableObjectState, _env: Env) {
		super(ctx, _env);

		ctx.blockConcurrencyWhile(async () => {
			const rows = await queryOnce((q) =>
				q.from({ m: this.messagesCollection }).select(({ m }) => ({
					id: m.id,
					threadId: m.threadId,
					body: m.body,
				})),
			);
			if (rows.length === 0) {
				const tx = this.messagesCollection.insert({
					id: "m1",
					threadId: "t1",
					body: "Seed message (synced)",
				});
				await tx.isPersisted.promise;
			}
		});
	}

	async fetch(request: Request): Promise<Response> {
		return this.app.fetch(request);
	}
}
