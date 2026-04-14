import {
	SyncServerBridge,
	createClientMessageSchema,
	createServerMessageSchema,
	type PartialSyncRowShape,
	type SyncClientMessage,
	type SyncServerMessage,
} from "@firtoz/collection-sync";
import type { SyncMessage } from "@firtoz/db-helpers";
import type { InferSchemaOutput, SyncMode } from "@tanstack/db";
import { createCollection } from "@tanstack/db";
import { drizzle } from "drizzle-orm/durable-sqlite";
import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import type { Context } from "hono";
import type {
	DrizzleSqliteTableCollection,
	SelectSchema,
	TableWithRequiredFields,
} from "@firtoz/drizzle-utils";
import {
	StandardSchemaSession,
	StandardSchemaWebSocketDO,
	type StandardSchemaSessionOptions,
} from "@firtoz/websocket-do";
import {
	durableSqliteCollectionOptions,
	type ValidTableNames,
} from "./durable-sqlite-collection";

/**
 * Drizzle/Valibot `InferSchemaOutput` is not always structurally assignable to
 * {@link PartialSyncRowShape}. Intersecting keeps inferred columns while requiring sync row keys for
 * {@link SyncServerBridge}.
 */
type SyncBridgeRowFromTable<TTable extends TableWithRequiredFields> =
	InferSchemaOutput<SelectSchema<TTable>> & PartialSyncRowShape;

export type SyncableDurableObjectSyncRow<
	TSchema extends Record<string, unknown>,
	TTableName extends ValidTableNames<TSchema>,
> = SyncBridgeRowFromTable<TSchema[TTableName] & TableWithRequiredFields>;

type SessionData = { clientId: string };

function createSessionCodecOptions<TItem extends PartialSyncRowShape>(
	enableBufferMessages: boolean,
	serializeJson?: (value: unknown) => string,
	deserializeJson?: (raw: string) => unknown,
): StandardSchemaSessionOptions<SyncClientMessage, SyncServerMessage<TItem>> {
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

class SyncTableSession<
	TItem extends PartialSyncRowShape,
	TEnv extends Cloudflare.Env,
> extends StandardSchemaSession<
	SessionData,
	SyncServerMessage<TItem>,
	SyncClientMessage,
	TEnv
> {
	public clientId: string;

	constructor(
		websocket: WebSocket,
		sessions: Map<WebSocket, SyncTableSession<TItem, TEnv>>,
		options: StandardSchemaSessionOptions<
			SyncClientMessage,
			SyncServerMessage<TItem>
		>,
		bridge: SyncServerBridge<TItem>,
	) {
		const generatedClientId = crypto.randomUUID();
		super(websocket, sessions, options, {
			createData: () => ({ clientId: generatedClientId }),
			handleValidatedMessage: async (message: SyncClientMessage) => {
				this.clientId = message.clientId;
				await bridge.handleClientMessage(message);
			},
			handleClose: async () => {},
		});
		this.clientId = generatedClientId;
	}
}

export type SyncableDurableObjectConfig<
	TSchema extends Record<string, unknown>,
	TTableName extends ValidTableNames<TSchema>,
> = {
	schema: TSchema;
	tableName: TTableName;
	migrations: Parameters<typeof migrate>[1];
	syncMode?: SyncMode;
	serializeJson?: (value: unknown) => string;
	deserializeJson?: (raw: string) => unknown;
};

/**
 * Durable Object base class: Drizzle SQLite + {@link SyncServerBridge} + WebSocket sessions.
 */
export abstract class SyncableDurableObject<
	TSchema extends Record<string, unknown>,
	TTableName extends ValidTableNames<TSchema>,
	TEnv extends Cloudflare.Env = Cloudflare.Env,
> extends StandardSchemaWebSocketDO<
	// biome-ignore lint/suspicious/noExplicitAny: StandardSchemaWebSocketDO session generic is internal; row type is fixed in constructor.
	any,
	SyncClientMessage,
	SyncServerMessage<unknown>,
	TEnv
> {
	protected bridge!: SyncServerBridge<
		SyncableDurableObjectSyncRow<TSchema, TTableName>
	>;

	protected collection!: DrizzleSqliteTableCollection<
		TSchema[TTableName] & TableWithRequiredFields
	>;

	readonly app = this.getBaseApp().get("/health", (c: Context) => c.text("ok"));

	constructor(
		ctx: DurableObjectState,
		env: TEnv,
		config: SyncableDurableObjectConfig<TSchema, TTableName>,
	) {
		type TTable = TSchema[TTableName] & TableWithRequiredFields;
		type TRow = SyncBridgeRowFromTable<TTable>;

		let bridgeRef!: SyncServerBridge<TRow>;

		super(ctx, env, {
			standardSchemaSessionOptions: (
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
			createStandardSchemaSession: (
				_sessionCtx: Context<{ Bindings: TEnv }> | undefined,
				websocket: WebSocket,
				options: StandardSchemaSessionOptions<
					SyncClientMessage,
					SyncServerMessage<unknown>
				>,
			) => {
				return new SyncTableSession<TRow, TEnv>(
					websocket,
					this.sessions,
					options as StandardSchemaSessionOptions<
						SyncClientMessage,
						SyncServerMessage<TRow>
					>,
					bridgeRef,
				);
			},
		});

		this.ctx.blockConcurrencyWhile(async () => {
			const db = drizzle(ctx.storage, { schema: config.schema });
			migrate(db, config.migrations);

			const tableName = config.tableName as never;

			const collection = createCollection(
				durableSqliteCollectionOptions({
					drizzle: db,
					tableName,
					syncMode: config.syncMode ?? "eager",
					// biome-ignore lint/suspicious/noExplicitAny: TanStack collection + Drizzle generic row inference is too heavy for TS here.
				}) as any,
			) as DrizzleSqliteTableCollection<TTable>;

			const col = collection as unknown as {
				insert: (v: unknown) => { isPersisted: { promise: Promise<void> } };
				update: (
					key: string | number,
					fn: (draft: unknown) => void,
				) => { isPersisted: { promise: Promise<void> } };
				delete: (key: string | number) => {
					isPersisted: { promise: Promise<void> };
				};
				utils: { truncate: () => Promise<void> };
				toArray: unknown[];
				state: { get: (key: string | number) => unknown | undefined };
				preload: () => void;
				onFirstReady: (cb: () => void) => void;
			};

			col.preload();
			await new Promise<void>((resolve) => {
				col.onFirstReady(() => resolve());
			});

			bridgeRef = new SyncServerBridge<TRow>({
				store: {
					applySyncMessages: async (messages: SyncMessage<TRow>[]) => {
						for (const message of messages) {
							if (message.type === "insert") {
								const tx = col.insert(message.value);
								await tx.isPersisted.promise;
								continue;
							}
							if (message.type === "update") {
								const value = message.value as { id: string | number };
								const tx = col.update(value.id, (draft) => {
									Object.assign(draft as object, message.value);
								});
								await tx.isPersisted.promise;
								continue;
							}
							if (message.type === "delete") {
								const tx = col.delete(message.key);
								await tx.isPersisted.promise;
								continue;
							}
							await col.utils.truncate();
						}
					},
					getSnapshotMessages: async () => {
						return (col.toArray as TRow[]).map((row) => ({
							type: "insert" as const,
							value: row,
						}));
					},
					getRow: async (key: string | number) => {
						return col.state.get(key) as TRow | undefined;
					},
				},
				sendToClient: (clientId: string, message: SyncServerMessage<TRow>) => {
					for (const session of this.sessions.values()) {
						const s = session as SyncTableSession<TRow, TEnv>;
						if (s.clientId === clientId) {
							s.send(message);
							return;
						}
					}
				},
				broadcastExcept: (
					excludeClientId: string,
					message: SyncServerMessage<TRow>,
				) => {
					for (const session of this.sessions.values()) {
						const s = session as SyncTableSession<TRow, TEnv>;
						if (s.clientId === excludeClientId) continue;
						s.send(message);
					}
				},
				broadcastAll: (message: SyncServerMessage<TRow>) => {
					for (const session of this.sessions.values()) {
						(session as SyncTableSession<TRow, TEnv>).send(message);
					}
				},
			});

			this.bridge = bridgeRef as SyncableDurableObject<
				TSchema,
				TTableName,
				TEnv
			>["bridge"];
			this.collection = collection;
		});
	}
}
