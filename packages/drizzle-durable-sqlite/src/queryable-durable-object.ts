import {
	PartialSyncServerBridge,
	createClientMessageSchema,
	createServerMessageSchema,
	type PartialSyncServerBridgeStore,
	type RangeCondition,
	type SyncClientMessage,
	type SyncRange,
	type SyncRangeSort,
	type SyncServerMessage,
} from "@firtoz/collection-sync";
import type { SyncMessage } from "@firtoz/db-helpers";
import {
	ZodSession,
	ZodWebSocketDO,
	type ZodSessionOptions,
} from "@firtoz/websocket-do";
import { drizzle } from "drizzle-orm/durable-sqlite";
import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import type { Context } from "hono";

type SessionData = { clientId: string };

type BridgeSlot<TRow> = {
	bridge?: PartialSyncServerBridge<TRow>;
	pending: SyncClientMessage[];
};

function createSessionCodecOptions<TItem extends { id: string | number }>(
	enableBufferMessages: boolean,
	serializeJson?: (value: unknown) => string,
	deserializeJson?: (raw: string) => unknown,
): ZodSessionOptions<SyncClientMessage, SyncServerMessage<TItem>> {
	const clientSchema = createClientMessageSchema();
	const serverSchema = createServerMessageSchema<TItem>();
	if (!enableBufferMessages) {
		return {
			clientSchema,
			serverSchema,
			enableBufferMessages: false,
			...(serializeJson && deserializeJson
				? { serializeJson, deserializeJson }
				: {}),
		};
	}
	return {
		clientSchema,
		serverSchema,
		enableBufferMessages: true,
	};
}

class QueryableSession<
	TItem extends { id: string | number },
	TEnv extends Cloudflare.Env,
> extends ZodSession<
	SessionData,
	SyncServerMessage<TItem>,
	SyncClientMessage,
	TEnv
> {
	public clientId: string;

	constructor(
		websocket: WebSocket,
		sessions: Map<WebSocket, QueryableSession<TItem, TEnv>>,
		options: ZodSessionOptions<SyncClientMessage, SyncServerMessage<TItem>>,
		private readonly bridgeSlot: BridgeSlot<TItem>,
	) {
		const generatedClientId = crypto.randomUUID();
		super(websocket, sessions, options, {
			createData: () => ({ clientId: generatedClientId }),
			handleValidatedMessage: async (message: SyncClientMessage) => {
				this.clientId = message.clientId;
				const bridge = this.bridgeSlot.bridge;
				if (bridge === undefined) {
					this.bridgeSlot.pending.push(message);
					return;
				}
				await bridge.handleClientMessage(message);
			},
			handleClose: async () => {},
		});
		this.clientId = generatedClientId;
	}
}

export type QueryableDurableObjectConfig<
	TSchema extends Record<string, unknown>,
> = {
	schema: TSchema;
	migrations: Parameters<typeof migrate>[1];
	queryChunkSize?: number;
	seedInBackground?: boolean;
	serializeJson?: (value: unknown) => string;
	deserializeJson?: (raw: string) => unknown;
};

export abstract class QueryableDurableObject<
	TRow extends { id: string | number },
	TSchema extends Record<string, unknown>,
	TEnv extends Cloudflare.Env = Cloudflare.Env,
	// biome-ignore lint/suspicious/noExplicitAny: session generic is not exposed in subclass APIs.
> extends ZodWebSocketDO<
	any,
	SyncClientMessage,
	SyncServerMessage<TRow>,
	TEnv
> {
	protected db!: ReturnType<typeof drizzle>;
	protected bridge!: PartialSyncServerBridge<TRow>;

	readonly app = this.getBaseApp().get("/health", (c: Context) => c.text("ok"));

	constructor(
		ctx: DurableObjectState,
		env: TEnv,
		config: QueryableDurableObjectConfig<TSchema>,
	) {
		let bridgeRef!: PartialSyncServerBridge<TRow>;
		const bridgeSlot: BridgeSlot<TRow> = { pending: [] };
		super(ctx, env, {
			zodSessionOptions: (
				sessionCtx: Context<{ Bindings: TEnv }> | undefined,
			) => {
				const useMsgpack =
					sessionCtx !== undefined &&
					new URL(sessionCtx.req.url).searchParams.get("transport") ===
						"msgpack";
				return createSessionCodecOptions<TRow>(
					useMsgpack,
					config.serializeJson,
					config.deserializeJson,
				);
			},
			createZodSession: (
				_sessionCtx: Context<{ Bindings: TEnv }> | undefined,
				websocket: WebSocket,
				options: ZodSessionOptions<
					SyncClientMessage,
					SyncServerMessage<unknown>
				>,
			) =>
				new QueryableSession<TRow, TEnv>(
					websocket,
					this.sessions as Map<WebSocket, QueryableSession<TRow, TEnv>>,
					options as ZodSessionOptions<
						SyncClientMessage,
						SyncServerMessage<TRow>
					>,
					bridgeSlot,
				),
		});

		this.ctx.blockConcurrencyWhile(async () => {
			const db = drizzle(ctx.storage, { schema: config.schema });
			migrate(db, config.migrations);
			this.db = db;

			const queryByPredicate = this.queryByPredicate;
			const getPredicateCount = this.getPredicateCount;
			const changesSince = this.changesSince;

			const store: PartialSyncServerBridgeStore<TRow> = {
				queryRange: (options) => this.queryRange(options),
				queryByOffset: (options) => this.queryByOffset(options),
				getTotalCount: async () => this.getTotalCount(),
				getSortValue: (row, column) => this.getSortValue(row, column),
				...(queryByPredicate !== undefined
					? {
							queryByPredicate: (opts: {
								conditions: RangeCondition[];
								sort?: SyncRangeSort;
								limit?: number;
								chunkSize: number;
							}) => queryByPredicate.call(this, opts),
						}
					: {}),
				...(getPredicateCount !== undefined
					? {
							getPredicateCount: (conditions: RangeCondition[]) =>
								getPredicateCount.call(this, conditions),
						}
					: {}),
				...(changesSince !== undefined
					? {
							changesSince: (opts: {
								range: SyncRange;
								sinceVersion: number;
								chunkSize: number;
							}) => changesSince.call(this, opts),
						}
					: {}),
			};
			bridgeRef = new PartialSyncServerBridge<TRow>({
				store,
				sendToClient: (clientId, message) =>
					this.sendToClient(clientId, message),
				queryChunkSize: config.queryChunkSize,
			});
			this.bridge = bridgeRef;
			bridgeSlot.bridge = bridgeRef;
			for (const message of bridgeSlot.pending) {
				await bridgeRef.handleClientMessage(message);
			}
			bridgeSlot.pending.length = 0;
			if (config.seedInBackground) {
				void this.seedData().catch((error: unknown) => {
					console.error("Background seedData failed", error);
				});
				return;
			}
			await this.seedData();
		});
	}

	protected abstract queryRange(options: {
		sort: { column: string; direction: "asc" | "desc" };
		limit: number;
		afterCursor: unknown | null;
		chunkSize: number;
	}): AsyncIterable<TRow[]>;

	protected abstract queryByOffset(options: {
		sort: { column: string; direction: "asc" | "desc" };
		limit: number;
		offset: number;
		chunkSize: number;
	}): AsyncIterable<TRow[]>;

	protected abstract getTotalCount(): Promise<number>;

	protected queryByPredicate?(_options: {
		conditions: RangeCondition[];
		sort?: SyncRangeSort;
		limit?: number;
		chunkSize: number;
	}): AsyncIterable<TRow[]>;

	protected getPredicateCount?(_conditions: RangeCondition[]): Promise<number>;

	protected changesSince?(_options: {
		range: SyncRange;
		sinceVersion: number;
		chunkSize: number;
	}): Promise<{ changes: SyncMessage<TRow>[]; totalCount: number } | null>;

	protected getSortValue(row: TRow, column: string): unknown {
		return (row as Record<string, unknown>)[column];
	}

	protected async seedData(): Promise<void> {}

	async pushServerChanges(changes: SyncMessage<TRow>[]): Promise<void> {
		await this.bridge.pushServerChanges(changes);
	}

	protected sendToClient(
		clientId: string,
		message: SyncServerMessage<TRow>,
	): void {
		for (const session of this.sessions.values()) {
			const typedSession = session as QueryableSession<TRow, TEnv>;
			if (typedSession.clientId !== clientId) continue;
			typedSession.send(message);
		}
	}
}
