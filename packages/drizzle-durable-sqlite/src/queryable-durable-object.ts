import {
	PartialSyncMutationHandler,
	PartialSyncServerBridge,
	createClientMessageSchema,
	createServerMessageSchema,
	DEFAULT_SYNC_COLLECTION_ID,
	type PartialSyncServerBridgeStore,
	type PartialSyncRowShape,
	type RangeCondition,
	type SyncClientMessage,
	type SyncRange,
	type SyncRangeSort,
	type SyncServerBridgeStore,
	type SyncServerMessage,
} from "@firtoz/collection-sync";
import type { SyncMessage } from "@firtoz/db-helpers";
import {
	ZodSession,
	ZodWebSocketDO,
	type ZodSessionOptions,
} from "@firtoz/websocket-do";
import type { DrizzleSqliteDODatabase } from "drizzle-orm/durable-sqlite";
import { drizzle } from "drizzle-orm/durable-sqlite";
import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import type { Context } from "hono";

type SessionData = { clientId: string };

type MutationSyncRow = PartialSyncRowShape;

type SessionDispatch<TRow extends MutationSyncRow> = {
	partialBridge: PartialSyncServerBridge<TRow>;
	partialMutationHandler?: PartialSyncMutationHandler<TRow>;
};

type SessionSlot<TRow extends MutationSyncRow> = {
	dispatch?: SessionDispatch<TRow>;
	pending: SyncClientMessage[];
};

function createSessionCodecOptions<TItem extends PartialSyncRowShape>(
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

async function routeQueryableClientMessage<TRow extends MutationSyncRow>(
	message: SyncClientMessage,
	dispatch: SessionDispatch<TRow>,
): Promise<void> {
	const mid = message.collectionId ?? DEFAULT_SYNC_COLLECTION_ID;
	switch (message.type) {
		case "mutateBatch":
		case "syncHello":
			if (
				dispatch.partialMutationHandler !== undefined &&
				mid === dispatch.partialMutationHandler.collectionId
			) {
				await dispatch.partialMutationHandler.handleClientMessage(message);
			}
			return;
		default:
			if (mid === dispatch.partialBridge.collectionId) {
				await dispatch.partialBridge.handleClientMessage(message);
			}
	}
}

class QueryableSession<
	TItem extends PartialSyncRowShape,
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
		private readonly sessionSlot: SessionSlot<TItem>,
	) {
		const generatedClientId = crypto.randomUUID();
		super(websocket, sessions, options, {
			createData: () => ({ clientId: generatedClientId }),
			handleValidatedMessage: async (message: SyncClientMessage) => {
				this.clientId = message.clientId;
				const dispatch = this.sessionSlot.dispatch;
				if (dispatch === undefined) {
					this.sessionSlot.pending.push(message);
					return;
				}
				await routeQueryableClientMessage(message, dispatch);
			},
			handleClose: async () => {
				const dispatch = this.sessionSlot.dispatch;
				if (dispatch !== undefined) {
					dispatch.partialBridge.removeClient(this.clientId);
				}
			},
		});
		this.clientId = generatedClientId;
	}
}

export type QueryableDurableObjectConfig<
	TSchema extends Record<string, unknown>,
	TRow extends PartialSyncRowShape = PartialSyncRowShape,
> = {
	schema: TSchema;
	migrations: Parameters<typeof migrate>[1];
	queryChunkSize?: number;
	seedInBackground?: boolean;
	serializeJson?: (value: unknown) => string;
	deserializeJson?: (raw: string) => unknown;
	/**
	 * When set, used as the partial-sync store instead of overriding
	 * {@link QueryableDurableObject.queryRange}, {@link QueryableDurableObject.queryByOffset},
	 * and {@link QueryableDurableObject.getTotalCount}.
	 */
	createPartialSyncStore?: (
		db: DrizzleSqliteDODatabase<TSchema>,
	) => PartialSyncServerBridgeStore<TRow>;
	/**
	 * Multiplex key for partial-sync WebSocket messages.
	 * When using {@link PartialSyncMutationHandler} on the same socket, use the same id unless you multiplex multiple collections.
	 */
	collectionId?: string;
	/**
	 * Server-side narrowing of client predicate viewports (e.g. fog of war). Passed to
	 * {@link PartialSyncServerBridge}.
	 */
	resolveClientVisibility?: (
		clientId: string,
		requestedConditions: RangeCondition[],
	) => RangeCondition[] | Promise<RangeCondition[]>;
	/**
	 * Optional hints for rows that left the client's range during `rangeReconcile`. Return `null` for
	 * fog of war (default when omitted).
	 */
	resolveMovedHint?: (
		row: TRow,
		range: SyncRange,
	) => Record<string, unknown> | null | Promise<Record<string, unknown> | null>;
};

export abstract class QueryableDurableObject<
	TRow extends PartialSyncRowShape,
	TSchema extends Record<string, unknown>,
	TEnv extends Cloudflare.Env = Cloudflare.Env,
> extends ZodWebSocketDO<
	QueryableSession<TRow, TEnv>,
	SyncClientMessage,
	SyncServerMessage<TRow>,
	TEnv
> {
	protected db!: ReturnType<typeof drizzle>;
	protected bridge!: PartialSyncServerBridge<TRow>;
	protected partialMutationHandler?: PartialSyncMutationHandler<TRow>;

	readonly app = this.getBaseApp().get("/health", (c: Context) => c.text("ok"));

	constructor(
		ctx: DurableObjectState,
		env: TEnv,
		config: QueryableDurableObjectConfig<TSchema, TRow>,
	) {
		let bridgeRef!: PartialSyncServerBridge<TRow>;
		const sessionSlot: SessionSlot<TRow> = { pending: [] };
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
					sessionSlot,
				),
		});

		this.ctx.blockConcurrencyWhile(async () => {
			const db = drizzle(ctx.storage, { schema: config.schema });
			migrate(db, config.migrations);
			this.db = db;

			const queryByPredicate = this.queryByPredicate;
			const getPredicateCount = this.getPredicateCount;
			const changesSince = this.changesSince;

			const store: PartialSyncServerBridgeStore<TRow> =
				config.createPartialSyncStore !== undefined
					? config.createPartialSyncStore(db)
					: {
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
			const collectionId = config.collectionId ?? DEFAULT_SYNC_COLLECTION_ID;
			bridgeRef = new PartialSyncServerBridge<TRow>({
				store,
				sendToClient: (clientId, message) =>
					this.sendToClient(clientId, message),
				queryChunkSize: config.queryChunkSize,
				collectionId,
				...(config.resolveClientVisibility !== undefined
					? {
							resolveClientVisibility: config.resolveClientVisibility,
						}
					: {}),
				...(config.resolveMovedHint !== undefined
					? { resolveMovedHint: config.resolveMovedHint }
					: {}),
			});
			this.bridge = bridgeRef;

			const mutationStore = this.createClientMutationSyncStore();
			let partialMutationHandler: PartialSyncMutationHandler<TRow> | undefined;
			if (mutationStore !== undefined) {
				partialMutationHandler = new PartialSyncMutationHandler<TRow>({
					store: mutationStore,
					partialBridge: bridgeRef,
					sendToClient: (clientId, message) =>
						this.sendToClient(clientId, message),
					collectionId,
				});
				this.partialMutationHandler = partialMutationHandler;
			}

			sessionSlot.dispatch = {
				partialBridge: bridgeRef,
				partialMutationHandler,
			};
			for (const message of sessionSlot.pending) {
				await routeQueryableClientMessage(message, sessionSlot.dispatch);
			}
			sessionSlot.pending.length = 0;
			if (config.seedInBackground) {
				void this.seedData().catch((error: unknown) => {
					console.error("Background seedData failed", error);
				});
				return;
			}
			await this.seedData();
		});
	}

	protected queryRange(_options: {
		sort: { column: string; direction: "asc" | "desc" };
		limit: number;
		afterCursor: unknown | null;
		chunkSize: number;
	}): AsyncIterable<TRow[]> {
		const message =
			"QueryableDurableObject: override queryRange() or pass createPartialSyncStore in config";
		return {
			[Symbol.asyncIterator](): AsyncIterator<TRow[]> {
				return {
					next: () => Promise.reject(new Error(message)),
				};
			},
		};
	}

	protected queryByOffset(_options: {
		sort: { column: string; direction: "asc" | "desc" };
		limit: number;
		offset: number;
		chunkSize: number;
	}): AsyncIterable<TRow[]> {
		const message =
			"QueryableDurableObject: override queryByOffset() or pass createPartialSyncStore in config";
		return {
			[Symbol.asyncIterator](): AsyncIterator<TRow[]> {
				return {
					next: () => Promise.reject(new Error(message)),
				};
			},
		};
	}

	protected async getTotalCount(): Promise<number> {
		throw new Error(
			"QueryableDurableObject: override getTotalCount() or pass createPartialSyncStore in config",
		);
	}

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

	/**
	 * When overridden to return a store, `mutateBatch` is handled by {@link PartialSyncMutationHandler}
	 * (interest-scoped `rangePatch` + `ack` with `serverVersion: 0`). `syncHello` is not handled on this path.
	 * Range traffic stays on {@link PartialSyncServerBridge}.
	 */
	protected createClientMutationSyncStore():
		| SyncServerBridgeStore<TRow>
		| undefined {
		return undefined;
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

	protected broadcastExcept(
		excludeClientId: string,
		message: SyncServerMessage<TRow>,
	): void {
		for (const session of this.sessions.values()) {
			const typedSession = session as QueryableSession<TRow, TEnv>;
			if (typedSession.clientId === excludeClientId) continue;
			typedSession.send(message);
		}
	}
}
