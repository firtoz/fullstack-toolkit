import { SockaWebSocketDO } from "socka/do";
import {
	createCloudflareDOSQLitePersistence,
	persistedCollectionOptions,
} from "@tanstack/cloudflare-durable-objects-db-sqlite-persistence";
import { createCollection, queryOnce } from "@tanstack/db";
import type { VpMessage } from "./vp-ws-protocol";
import { sortVpMessagesForDisplay } from "./vp-message-sort";
import { VirtualPropsWsSockaSession } from "./vp-ws-zod-session";

const VP_MESSAGES_COLLECTION_ID = "vp-messages-ws";

export class VirtualPropsWsTanstackDO extends SockaWebSocketDO<
	VirtualPropsWsSockaSession,
	Env
> {
	app = this.getBaseApp();

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

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env, {
			createSockaSession: (_ctx, websocket) =>
				new VirtualPropsWsSockaSession(websocket, this.sessions, {
					listMessages: async () => {
						const rows = await queryOnce((q) =>
							q.from({ m: this.messagesCollection }).select(({ m }) => ({
								id: m.id,
								threadId: m.threadId,
								body: m.body,
							})),
						);
						return sortVpMessagesForDisplay(rows);
					},
					insertMessage: async (m) => {
						const tx = this.messagesCollection.insert({
							id: m.id,
							threadId: m.threadId,
							body: m.body,
						});
						await tx.isPersisted.promise;
					},
				}),
		});

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
}
