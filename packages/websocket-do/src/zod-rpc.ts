import {
	type ZodWebSocketClientOptions,
	ZodWebSocketClient,
} from "./ZodWebSocketClient";

export type ZodWebSocketRpcSessionConstructorOptions<
	TClientMsg,
	TServerMsg,
	TPending extends { reject: (error: Error) => void },
> = Omit<ZodWebSocketClientOptions<TClientMsg, TServerMsg>, "onMessage"> & {
	onMessage: (
		message: TServerMsg,
		session: ZodWebSocketRpcSession<TClientMsg, TServerMsg, TPending>,
	) => void;
};

/**
 * WebSocket client session with a pending map for request/response RPC and a
 * monotonic id helper. Wire formats stay in your Zod schemas; you dispatch
 * {@link TServerMsg} in `onMessage` (typically with `switch` + `exhaustiveGuard`)
 * and resolve/reject entries in {@link pending}.
 */
export class ZodWebSocketRpcSession<
	TClientMsg,
	TServerMsg,
	TPending extends { reject: (error: Error) => void },
> {
	readonly pending = new Map<string, TPending>();
	readonly client: ZodWebSocketClient<TClientMsg, TServerMsg>;
	private idSeq = 0;

	constructor(
		options: ZodWebSocketRpcSessionConstructorOptions<
			TClientMsg,
			TServerMsg,
			TPending
		>,
	) {
		const { onMessage, ...clientOptions } = options;
		this.client = new ZodWebSocketClient({
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

export function createZodWebSocketRpcSession<
	TClientMsg,
	TServerMsg,
	TPending extends { reject: (error: Error) => void },
>(
	options: ZodWebSocketRpcSessionConstructorOptions<
		TClientMsg,
		TServerMsg,
		TPending
	>,
): ZodWebSocketRpcSession<TClientMsg, TServerMsg, TPending> {
	return new ZodWebSocketRpcSession(options);
}
