import {
	SyncServerBridge,
	createClientMessageSchema,
	createServerMessageSchema,
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
	ZodSession,
	ZodWebSocketDO,
	type ZodSessionOptions,
} from "@firtoz/websocket-do";
import {
	durableSqliteCollectionOptions,
	type ValidTableNames,
} from "./durable-sqlite-collection";

type BridgeRow<T> = T & {
	id: string | number;
	updatedAt?: number | Date | null;
};

type SessionData = { clientId: string };

function createSessionCodecOptions<TItem extends { id: string | number }>(
	enableBufferMessages: boolean,
	serializeJson?: (value: unknown) => string,
	deserializeJson?: (raw: string) => unknown,
): ZodSessionOptions<SyncClientMessage, SyncServerMessage<BridgeRow<TItem>>> {
	const clientSchema = createClientMessageSchema();
	const serverSchema = createServerMessageSchema<BridgeRow<TItem>>();
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
	TItem extends { id: string | number; updatedAt?: number | Date | null },
	TEnv extends Cloudflare.Env,
> extends ZodSession<
	SessionData,
	SyncServerMessage<BridgeRow<TItem>>,
	SyncClientMessage,
	TEnv
> {
	public clientId: string;

	constructor(
		websocket: WebSocket,
		sessions: Map<WebSocket, SyncTableSession<TItem, TEnv>>,
		options: ZodSessionOptions<
			SyncClientMessage,
			SyncServerMessage<BridgeRow<TItem>>
		>,
		bridge: SyncServerBridge<BridgeRow<TItem>>,
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
	// biome-ignore lint/suspicious/noExplicitAny: ZodWebSocketDO session generic is internal; row type is TBridgeRow in constructor.
> extends ZodWebSocketDO<
	any,
	SyncClientMessage,
	SyncServerMessage<unknown>,
	TEnv
> {
	protected bridge!: SyncServerBridge<
		BridgeRow<
			InferSchemaOutput<
				SelectSchema<TSchema[TTableName] & TableWithRequiredFields>
			>
		>
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
		type TRow = InferSchemaOutput<SelectSchema<TTable>>;
		type TBridgeRow = BridgeRow<TRow>;

		let bridgeRef!: SyncServerBridge<TBridgeRow>;

		super(ctx, env, {
			zodSessionOptions: (
				sessionCtx: Context<{ Bindings: TEnv }> | undefined,
			) => {
				const useMsgpack =
					sessionCtx !== undefined &&
					new URL(sessionCtx.req.url).searchParams.get("transport") ===
						"msgpack";
				return createSessionCodecOptions<TBridgeRow>(
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
			) => {
				return new SyncTableSession<TBridgeRow, TEnv>(
					websocket,
					this.sessions as Map<WebSocket, SyncTableSession<TBridgeRow, TEnv>>,
					options as ZodSessionOptions<
						SyncClientMessage,
						SyncServerMessage<TBridgeRow>
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
				// biome-ignore lint/suspicious/noExplicitAny: TanStack collection + Drizzle generic row inference is too heavy for TS here.
				durableSqliteCollectionOptions({
					drizzle: db,
					tableName,
					syncMode: config.syncMode ?? "eager",
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

			bridgeRef = new SyncServerBridge<TBridgeRow>({
				store: {
					applySyncMessages: async (messages: SyncMessage<TBridgeRow>[]) => {
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
						return (col.toArray as TBridgeRow[]).map((row) => ({
							type: "insert" as const,
							value: row,
						}));
					},
					getRow: (key: string | number) => {
						return col.state.get(key) as TBridgeRow | undefined;
					},
				},
				sendToClient: (
					clientId: string,
					message: SyncServerMessage<TBridgeRow>,
				) => {
					for (const session of this.sessions.values()) {
						const s = session as SyncTableSession<TBridgeRow, TEnv>;
						if (s.clientId === clientId) {
							s.send(message);
							return;
						}
					}
				},
				broadcastExcept: (
					excludeClientId: string,
					message: SyncServerMessage<TBridgeRow>,
				) => {
					for (const session of this.sessions.values()) {
						const s = session as SyncTableSession<TBridgeRow, TEnv>;
						if (s.clientId === excludeClientId) continue;
						s.send(message);
					}
				},
				broadcastAll: (message: SyncServerMessage<TBridgeRow>) => {
					for (const session of this.sessions.values()) {
						(session as SyncTableSession<TBridgeRow, TEnv>).send(message);
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
