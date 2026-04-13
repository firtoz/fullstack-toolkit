import {
	type StandardSchemaWebSocketClientOptions,
	StandardSchemaWebSocketClient,
} from "./StandardSchemaWebSocketClient";

export type StandardSchemaWebSocketRpcSessionConstructorOptions<
	TClientMsg,
	TServerMsg,
	TPending extends { reject: (error: Error) => void },
> = Omit<
	StandardSchemaWebSocketClientOptions<TClientMsg, TServerMsg>,
	"onMessage"
> & {
	onMessage: (
		message: TServerMsg,
		session: StandardSchemaWebSocketRpcSession<
			TClientMsg,
			TServerMsg,
			TPending
		>,
	) => void;
};

/**
 * WebSocket client session with a pending map for request/response RPC and a
 * monotonic id helper. Wire formats stay in your Standard Schema schemas; you dispatch
 * {@link TServerMsg} in `onMessage` (typically with `switch` + `exhaustiveGuard`)
 * and resolve/reject entries in {@link pending}.
 */
export class StandardSchemaWebSocketRpcSession<
	TClientMsg,
	TServerMsg,
	TPending extends { reject: (error: Error) => void },
> {
	readonly pending = new Map<string, TPending>();
	readonly client: StandardSchemaWebSocketClient<TClientMsg, TServerMsg>;
	private idSeq = 0;

	constructor(
		options: StandardSchemaWebSocketRpcSessionConstructorOptions<
			TClientMsg,
			TServerMsg,
			TPending
		>,
	) {
		const { onMessage, ...clientOptions } = options;
		this.client = new StandardSchemaWebSocketClient({
			...clientOptions,
			onMessage: (message) => {
				onMessage(message, this);
			},
		});
	}

	nextId(prefix: string): string {
		return `${prefix}-${++this.idSeq}`;
	}

	rejectAllPending(reason: Error): void {
		for (const [, pending] of this.pending) {
			pending.reject(reason);
		}
		this.pending.clear();
	}

	close(code?: number, reason?: string): void {
		this.client.close(code, reason);
	}
}

export function createStandardSchemaWebSocketRpcSession<
	TClientMsg,
	TServerMsg,
	TPending extends { reject: (error: Error) => void },
>(
	options: StandardSchemaWebSocketRpcSessionConstructorOptions<
		TClientMsg,
		TServerMsg,
		TPending
	>,
): StandardSchemaWebSocketRpcSession<TClientMsg, TServerMsg, TPending> {
	return new StandardSchemaWebSocketRpcSession(options);
}
