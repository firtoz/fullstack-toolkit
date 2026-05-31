import { SockaError } from "@firtoz/socka/core";
import { SockaWebSocketDO, type SockaDoSessionConfigInput } from "@firtoz/socka/do";
import {
	createCloudflareDOSQLitePersistence,
	persistedCollectionOptions,
} from "@tanstack/cloudflare-durable-objects-db-sqlite-persistence";
import { createCollection, queryOnce } from "@tanstack/db";
import type { VpMessage } from "./vp-ws-protocol";
import { vpContract } from "./vp-ws-protocol";
import { sortVpMessagesForDisplay } from "./vp-message-sort";
import { VP_SLOW_INSERT_DELAY_MS } from "./vp-demo-constants";

const VP_MESSAGES_COLLECTION_ID = "vp-messages-ws";

export class VirtualPropsWsTanstackDO extends SockaWebSocketDO<
	typeof vpContract,
	Record<string, never>,
	Env
> {
	protected readonly contract = vpContract;
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
		super(ctx, env);

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

	protected buildSockaSessionConfig(): SockaDoSessionConfigInput<
		typeof vpContract,
		Record<string, never>,
		Env
	> {
		return {
			handlers: {
				list: async () => {
					const rows = await queryOnce((q) =>
						q.from({ m: this.messagesCollection }).select(({ m }) => ({
							id: m.id,
							threadId: m.threadId,
							body: m.body,
						})),
					);
					return sortVpMessagesForDisplay(rows);
				},
				insert: async (input) => {
					const delayMs = input.slow === true ? VP_SLOW_INSERT_DELAY_MS : 0;
					if (delayMs > 0) {
						await new Promise((r) => setTimeout(r, delayMs));
					}
					try {
						const tx = this.messagesCollection.insert({
							id: input.message.id,
							threadId: input.message.threadId,
							body: input.message.body,
						});
						await tx.isPersisted.promise;
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
