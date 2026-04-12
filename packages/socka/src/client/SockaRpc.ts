import type {
	SockaContract,
	SockaContractConfig,
	InferSockaRpc,
	InferSockaEventHandlers,
} from "../core/contract";
import { parseStandardSchema } from "../core/validate";
import { SockaError } from "../core/socka-error";
import type {
	SockaServerResponseFrame,
	SockaServerErrorFrame,
	SockaServerEventFrame,
} from "../core/envelope";
import {
	SockaWebSocketClient,
	type SockaWebSocketClientOptions,
} from "./SockaWebSocketClient";

type PendingEntry = {
	rpc: string;
	resolve: (value: unknown) => void;
	reject: (error: Error) => void;
};

export type SockaRpcOptions<
	TContract extends SockaContract<SockaContractConfig>,
> = Omit<
	SockaWebSocketClientOptions<TContract>,
	"onResponse" | "onServerError" | "onEvent"
> & {
	onOpen?: (event: Event) => void;
	onClose?: (event: CloseEvent) => void;
	onError?: (event: Event) => void;
	eventHandlers?: Partial<InferSockaEventHandlers<TContract>>;
};

/**
 * Browser WebSocket RPC session driven by a socka contract.
 * Generates fully typed RPC methods and manages pending correlation.
 */
export class SockaRpc<TContract extends SockaContract<SockaContractConfig>> {
	readonly client: SockaWebSocketClient<TContract>;
	readonly rpc: InferSockaRpc<TContract>;
	private readonly pending = new Map<string, PendingEntry>();
	private idSeq = 0;
	private readonly eventHandlers?: Partial<InferSockaEventHandlers<TContract>>;

	constructor(options: SockaRpcOptions<TContract>) {
		const { eventHandlers, ...clientOpts } = options;
		this.eventHandlers = eventHandlers;

		this.client = new SockaWebSocketClient({
			...clientOpts,
			onResponse: (frame) => this.handleResponse(frame),
			onServerError: (frame) => this.handleServerError(frame),
			onEvent: (frame) => this.handleEvent(frame),
		});

		this.rpc = this.buildRpcMethods();
	}

	private buildRpcMethods(): InferSockaRpc<TContract> {
		const methods: Record<string, (input?: unknown) => Promise<unknown>> = {};

		for (const name of Object.keys(this.client.contract.procedures)) {
			const proc = this.client.contract.procedures[name];
			if (proc.input) {
				methods[name] = (input: unknown) => this.call(name, input);
			} else {
				methods[name] = () => this.call(name, undefined);
			}
		}

		return methods as InferSockaRpc<TContract>;
	}

	private call(procedure: string, input: unknown): Promise<unknown> {
		return new Promise<unknown>((resolve, reject) => {
			if (this.client.readyState !== WebSocket.OPEN) {
				reject(new Error("WebSocket not connected"));
				return;
			}
			const id = this.nextId(procedure);
			this.pending.set(id, { rpc: procedure, resolve, reject });
			const body =
				input !== undefined && input !== null
					? (input as Record<string, unknown>)
					: {};
			try {
				this.client.sendRequest(id, procedure, body);
			} catch (err) {
				this.pending.delete(id);
				reject(err instanceof Error ? err : new Error(String(err)));
			}
		});
	}

	private handleResponse(frame: SockaServerResponseFrame): void {
		const entry = this.pending.get(frame.id);
		if (!entry) return;
		this.pending.delete(frame.id);

		const proc = this.client.contract.procedures[frame.rpc];
		if (!proc) {
			entry.reject(new SockaError(`Unknown procedure: ${frame.rpc}`));
			return;
		}

		void Promise.resolve()
			.then(() => parseStandardSchema(proc.output, frame.body))
			.then(
				(validated) => entry.resolve(validated),
				(err) =>
					entry.reject(err instanceof Error ? err : new Error(String(err))),
			);
	}

	private handleServerError(frame: SockaServerErrorFrame): void {
		const entry = this.pending.get(frame.id);
		if (!entry) return;
		this.pending.delete(frame.id);
		entry.reject(SockaError.fromWire(frame));
	}

	private handleEvent(frame: SockaServerEventFrame): void {
		if (!this.eventHandlers) return;
		const handler = (
			this.eventHandlers as Record<
				string,
				((payload: unknown) => void | Promise<void>) | undefined
			>
		)[frame.event];
		if (!handler) return;

		const schema = (
			this.client.contract.events as Record<
				string,
				{ "~standard": { validate: (v: unknown) => unknown } } | undefined
			>
		)[frame.event];
		if (schema) {
			void Promise.resolve()
				.then(() =>
					parseStandardSchema(
						schema as Parameters<typeof parseStandardSchema>[0],
						frame.body,
					),
				)
				.then(
					(validated) => handler(validated),
					(err) => console.error("socka: event validation error", err),
				);
		} else {
			void Promise.resolve(handler(frame.body)).catch((err: unknown) => {
				console.error("socka: event handler error", err);
			});
		}
	}

	private nextId(prefix: string): string {
		return `${prefix}-${++this.idSeq}`;
	}

	rejectAllPending(reason: Error): void {
		for (const [, entry] of this.pending) {
			entry.reject(reason);
		}
		this.pending.clear();
	}

	close(code?: number, reason?: string): void {
		this.client.close(code, reason);
	}
}
