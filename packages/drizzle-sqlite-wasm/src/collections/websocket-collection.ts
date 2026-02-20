import type {
	CollectionConfig,
	SyncConfig,
	InsertMutationFnParams,
	UpdateMutationFnParams,
	DeleteMutationFnParams,
	UtilsRecord,
	BaseCollectionConfig,
	InferSchemaOutput,
	InferSchemaInput,
} from "@tanstack/db";
import { exhaustiveGuard } from "@firtoz/maybe-error";
import type { StandardSchemaV1 } from "@standard-schema/spec";

interface WebSocketMessage<T> {
	type: "insert" | "update" | "delete" | "sync" | "transaction" | "ack";
	data?: T | T[];
	mutations?: Array<{
		type: "insert" | "update" | "delete";
		data: T;
		id?: string;
	}>;
	transactionId?: string;
	id?: string;
}

interface WebSocketCollectionConfig<TSchema extends StandardSchemaV1>
	extends Omit<
		BaseCollectionConfig<InferSchemaOutput<TSchema>, string | number, TSchema>,
		"onInsert" | "onUpdate" | "onDelete" | "sync" | "schema"
	> {
	url: string;
	reconnectInterval?: number;
	schema: TSchema;

	// Note: onInsert/onUpdate/onDelete are handled by the WebSocket connection
	// Users don't provide these handlers
}

interface WebSocketUtils extends UtilsRecord {
	reconnect: () => void;
	getConnectionState: () => "connected" | "disconnected" | "connecting";
}

export function webSocketCollectionOptions<TSchema extends StandardSchemaV1>(
	config: WebSocketCollectionConfig<TSchema>,
): CollectionConfig<InferSchemaOutput<TSchema>, string | number, TSchema> & {
	utils: WebSocketUtils;
	schema: TSchema;
} {
	type TItem = InferSchemaOutput<TSchema>;

	let ws: WebSocket | null = null;
	let reconnectTimer: NodeJS.Timeout | null = null;
	let connectionState: "connected" | "disconnected" | "connecting" =
		"disconnected";

	// Track pending transactions awaiting acknowledgment
	const pendingTransactions = new Map<
		string,
		{
			resolve: () => void;
			reject: (error: Error) => void;
			timeout: NodeJS.Timeout;
		}
	>();

	const handlers: {
		onOpen?: () => void;
		onMessage?: (event: MessageEvent) => void;
		onError?: (error: Event) => void;
		onClose?: () => void;
	} = {};

	const connect = () => {
		connectionState = "connecting";
		ws = new WebSocket(config.url);

		ws.onopen = () => {
			handlers.onOpen?.();
		};
		ws.onmessage = (event) => {
			handlers.onMessage?.(event);
		};
		ws.onerror = (error) => {
			handlers.onError?.(error);
		};
		ws.onclose = () => {
			handlers.onClose?.();
		};
	};

	const sync: SyncConfig<TItem>["sync"] = (params) => {
		const { begin, write, commit, markReady } = params;

		handlers.onOpen = () => {
			if (!ws) return;

			connectionState = "connected";
			// Request initial sync
			ws.send(JSON.stringify({ type: "sync" }));
		};

		handlers.onMessage = (event) => {
			if (!ws) return;

			const message: WebSocketMessage<TItem> = JSON.parse(event.data);

			switch (message.type) {
				case "sync":
					// Initial sync with array of items
					begin();
					if (Array.isArray(message.data)) {
						for (const item of message.data) {
							write({ type: "insert", value: item });
						}
					}
					commit();
					markReady();
					break;

				case "insert":
				case "update":
				case "delete":
					// Real-time updates from other clients
					begin();
					write({
						type: message.type,
						value: message.data as InferSchemaInput<TSchema>,
					});
					commit();
					break;

				case "ack":
					// Server acknowledged our transaction
					if (message.transactionId) {
						const pending = pendingTransactions.get(message.transactionId);
						if (pending) {
							clearTimeout(pending.timeout);
							pendingTransactions.delete(message.transactionId);
							pending.resolve();
						}
					}
					break;

				case "transaction":
					// Server sending back the actual data after processing our transaction
					if (message.mutations) {
						begin();
						for (const mutation of message.mutations) {
							write({
								type: mutation.type,
								value: mutation.data,
							});
						}
						commit();
					}
					break;
				default:
					exhaustiveGuard(message.type);
			}
		};

		handlers.onError = (error) => {
			console.error("WebSocket error:", error);
			connectionState = "disconnected";
		};

		handlers.onClose = () => {
			connectionState = "disconnected";
			// Auto-reconnect
			if (!reconnectTimer) {
				reconnectTimer = setTimeout(() => {
					reconnectTimer = null;
					connect();
				}, config.reconnectInterval || 5000);
			}
		};

		// Start connection
		connect();

		// Return cleanup function
		return () => {
			if (reconnectTimer) {
				clearTimeout(reconnectTimer);
				reconnectTimer = null;
			}
			if (ws) {
				ws.close();
				ws = null;
			}
		};
	};

	// Helper function to send transaction and wait for server acknowledgment
	const sendTransaction = async (
		params:
			| InsertMutationFnParams<TItem>
			| UpdateMutationFnParams<TItem>
			| DeleteMutationFnParams<TItem>,
	): Promise<void> => {
		if (ws?.readyState !== WebSocket.OPEN) {
			throw new Error("WebSocket not connected");
		}

		const transactionId = crypto.randomUUID();

		// Convert all mutations in the transaction to the wire format
		const mutations = params.transaction.mutations.map((mutation) => {
			switch (mutation.type) {
				case "insert":
					return {
						type: mutation.type,
						id: mutation.key,
						data: mutation.modified,
					};
				case "update":
					return {
						type: mutation.type,
						id: mutation.key,
						data: mutation.changes,
					};
				case "delete":
					return {
						type: mutation.type,
						id: mutation.key,
						data: undefined,
					};
				default:
					return exhaustiveGuard(mutation);
			}
		});

		// Send the entire transaction at once
		ws.send(
			JSON.stringify({
				type: "transaction",
				transactionId,
				mutations,
			}),
		);

		// Wait for server acknowledgment
		return new Promise<void>((resolve, reject) => {
			const timeout = setTimeout(() => {
				pendingTransactions.delete(transactionId);
				reject(new Error(`Transaction ${transactionId} timed out`));
			}, 10000); // 10 second timeout

			pendingTransactions.set(transactionId, {
				resolve,
				reject,
				timeout,
			});
		});
	};

	// All mutation handlers use the same transaction sender
	const onInsert = async (params: InsertMutationFnParams<TItem>) => {
		await sendTransaction(params);
	};

	const onUpdate = async (params: UpdateMutationFnParams<TItem>) => {
		await sendTransaction(params);
	};

	const onDelete = async (params: DeleteMutationFnParams<TItem>) => {
		await sendTransaction(params);
	};

	return {
		id: config.id,
		schema: config.schema,
		getKey: config.getKey,
		sync: { sync },
		onInsert,
		onUpdate,
		onDelete,
		utils: {
			reconnect: () => {
				if (ws) ws.close();
				connect();
			},
			getConnectionState: () => connectionState,
		},
	};
}
