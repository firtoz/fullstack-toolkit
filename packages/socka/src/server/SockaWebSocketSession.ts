import type { StandardSchemaV1 } from "@standard-schema/spec";
import { exhaustiveGuard } from "@firtoz/maybe-error";
import type {
	InferSockaPushPayload,
	SockaContractBound,
} from "../core/contract";
import {
	SockaWireError,
	decodeSockaWire,
	encodeServerResponse,
	encodeServerError,
	encodeServerEvent,
	type SockaClientRequestFrame,
	type SockaWireFrame,
} from "../core/envelope";
import {
	encodeSockaWire,
	parseWirePayload,
	type SockaWireFormat,
} from "../core/wire-codec";
import { reportSockaError } from "../core/socka-report-error";
import { parseStandardSchema } from "../core/validate";
import { SockaError } from "../core/socka-error";
import type {
	SockaStrictWebSocketInit,
	SockaWebSocketInit,
	SockaWebSocketSessionConfig,
	SockaWebSocketSessionConfigLoose,
	SockaWebSocketSessionConfigUnion,
} from "./SockaWebSocketSessionConfig";

/** Session data with no fields — `createData` may be omitted (defaults to `{}`). */
type EmptySockaSessionData = Record<string, never>;

export type {
	SockaStrictWebSocketInit,
	SockaWebSocketInit,
	SockaWebSocketSessionConfig,
	SockaWebSocketSessionConfigLoose,
	SockaWebSocketSessionConfigUnion,
};

function isLooseUpgradeConfig<TContract extends SockaContractBound, TData>(
	config: SockaWebSocketSessionConfigUnion<TContract, TData>,
): config is SockaWebSocketSessionConfigLoose<TContract, TData> {
	return (
		"strictUpgradeRequest" in config && config.strictUpgradeRequest === false
	);
}

/** Session that can send a wire-level server event (already validated). */
export type SockaEmitCapable = {
	emitWireEvent(event: string, body: unknown): void;
};

/**
 * Contract-typed session surface for handlers that push to clients.
 */
export interface SockaPushSession<TContract extends SockaContractBound> {
	emitPush<K extends keyof TContract["pushes"] & string>(
		name: K,
		body: InferSockaPushPayload<TContract, K>,
	): Promise<void>;
	broadcastPush<K extends keyof TContract["pushes"] & string>(
		name: K,
		body: InferSockaPushPayload<TContract, K>,
		excludeSelf?: boolean,
	): Promise<void>;
}

/**
 * Broadcast a socka server event to every session in the map (optionally
 * excluding the caller). Payload must already be contract-validated.
 *
 * Exclusion uses the **WebSocket** identity (`self.websocket`), not the session
 * object reference, so the same `sessions` map can hold `SockaDoSession` while
 * `broadcastPush` runs on `this.socka` (inner {@link SockaWebSocketSession}).
 *
 * When there is no caller session, use {@link broadcastSockaEventToAll} or
 * {@link broadcastContractPushToAll} instead of picking an arbitrary anchor.
 */
export function broadcastSockaEventToPeers(
	sessions: Map<WebSocket, SockaEmitCapable>,
	self: SockaEmitCapable & { readonly websocket: WebSocket },
	event: string,
	body: unknown,
	excludeSelf = false,
): void {
	for (const [ws, session] of sessions) {
		if (excludeSelf && ws === self.websocket) continue;
		session.emitWireEvent(event, body);
	}
}

/**
 * Broadcast a socka server event to **every** session in the map. Payload must
 * already be contract-validated.
 *
 * Use when there is no originating WebSocket session (HTTP admin routes, alarms,
 * cron). Prefer {@link broadcastContractPushToAll} so validation stays centralized.
 */
export function broadcastSockaEventToAll(
	sessions: Map<WebSocket, SockaEmitCapable>,
	event: string,
	body: unknown,
): void {
	for (const session of sessions.values()) {
		session.emitWireEvent(event, body);
	}
}

/**
 * Validate a contract push payload and broadcast it to every session in the map.
 *
 * Works with any session type that implements {@link SockaEmitCapable} (including
 * {@link SockaDoSession} on Durable Objects). No-op when `sessions` is empty.
 */
export async function broadcastContractPushToAll<
	TContract extends SockaContractBound,
	K extends keyof TContract["pushes"] & string,
>(
	sessions: Map<WebSocket, SockaEmitCapable>,
	contract: TContract,
	name: K,
	body: InferSockaPushPayload<TContract, K>,
): Promise<void> {
	const schema = contract.pushes[name];
	if (!schema) {
		throw new Error(`socka: unknown push ${String(name)}`);
	}
	const validated = await parseStandardSchema(
		schema as StandardSchemaV1<unknown, InferSockaPushPayload<TContract, K>>,
		body,
	);
	broadcastSockaEventToAll(sessions, name, validated);
}

/**
 * Runtime-agnostic socka server session: standard {@link WebSocket} wire
 * dispatch without Cloudflare Durable Object APIs.
 */
export class SockaWebSocketSession<
	TContract extends SockaContractBound,
	TData = EmptySockaSessionData,
> implements SockaPushSession<TContract>
{
	private readonly config: SockaWebSocketSessionConfigUnion<TContract, TData>;
	private readonly wireFormat: SockaWireFormat;
	private _data!: TData;

	public constructor(
		public readonly websocket: WebSocket,
		protected readonly sessions: Map<
			WebSocket,
			SockaWebSocketSession<TContract, TData>
		>,
		config: SockaWebSocketSessionConfigUnion<TContract, TData>,
		init?: SockaWebSocketInit,
	) {
		this.config = config;
		this.wireFormat = config.wireFormat ?? "json";
		if (isLooseUpgradeConfig(config)) {
			const createData = config.createData as
				| ((init: SockaWebSocketInit) => TData)
				| undefined;
			const create = createData ?? ((_i: SockaWebSocketInit) => ({}) as TData);
			this._data = create(init ?? {});
		} else {
			if (!init?.request) {
				throw new Error(
					"socka: strict upgrade (default) requires a Request on the upgrade init (e.g. Bun upgrade with `data: { …, request: req }`, or Hono default sockaInit), or use SockaWebSocketSessionConfigLoose with strictUpgradeRequest: false",
				);
			}
			const strictInit: SockaStrictWebSocketInit = { request: init.request };
			if (config.createData) {
				this._data = config.createData(strictInit);
			} else {
				this._data = {} as TData;
			}
		}
	}

	public get data(): TData {
		return this._data;
	}

	/**
	 * Session data for every connection in the same {@link sessions} map (same room),
	 * optionally excluding this socket.
	 */
	public listPeers(options?: { excludeSelf?: boolean }): TData[] {
		const out: TData[] = [];
		for (const [ws, s] of this.sessions) {
			if (options?.excludeSelf && ws === this.websocket) continue;
			out.push(s.data);
		}
		return out;
	}

	/**
	 * Like {@link listPeers} but maps each peer {@link SockaWebSocketSession}
	 * (e.g. when you need more than {@link #data}).
	 */
	public listPeersWith<R>(
		map: (session: SockaWebSocketSession<TContract, TData>) => R,
		options?: { excludeSelf?: boolean },
	): R[] {
		const out: R[] = [];
		for (const [ws, s] of this.sessions) {
			if (options?.excludeSelf && ws === this.websocket) continue;
			out.push(map(s));
		}
		return out;
	}

	/** Count of sessions in this room (same {@link sessions} map), optionally excluding self. */
	public peerCount(options?: { excludeSelf?: boolean }): number {
		let n = 0;
		for (const [ws] of this.sessions) {
			if (options?.excludeSelf && ws === this.websocket) continue;
			n += 1;
		}
		return n;
	}

	/** Whether any peer sessions exist (optionally excluding self). */
	public hasPeers(options?: { excludeSelf?: boolean }): boolean {
		return this.peerCount(options) > 0;
	}

	/**
	 * Invokes the user {@link typeof SockaWebSocketSessionConfig.handleClose} callback.
	 * Server adapters should call this when the WebSocket closes, **before** deleting
	 * this session from the shared `sessions` map.
	 */
	public async invokeHandleClose(): Promise<void> {
		await this.config.handleClose(this);
	}

	public async handleRawMessage(rawMessage: string): Promise<void> {
		if (this.wireFormat !== "json") {
			await this.reportValidationError(
				new Error("socka: unexpected JSON frame in msgpack mode"),
				rawMessage,
			);
			return;
		}
		const deserialize = this.config.deserializeJson ?? JSON.parse;
		let parsed: unknown;
		try {
			parsed = deserialize(rawMessage);
		} catch {
			await this.reportValidationError(
				new Error("socka: invalid JSON"),
				rawMessage,
			);
			return;
		}
		await this.dispatchAfterParsed(parsed, rawMessage);
	}

	public async handleBinaryMessage(buffer: ArrayBuffer): Promise<void> {
		if (this.wireFormat !== "msgpack") {
			await this.reportValidationError(
				new Error("socka: unexpected binary frame in JSON mode"),
				buffer,
			);
			return;
		}
		let parsed: unknown;
		try {
			parsed = parseWirePayload(buffer, "msgpack");
		} catch (err) {
			await this.reportValidationError(
				err instanceof Error ? err : new Error("socka: msgpack decode failed"),
				buffer,
			);
			return;
		}
		await this.dispatchAfterParsed(parsed, buffer);
	}

	private async dispatchAfterParsed(
		parsed: unknown,
		originalWire: unknown,
	): Promise<void> {
		let decoded: ReturnType<typeof decodeSockaWire>;
		try {
			decoded = decodeSockaWire(parsed);
		} catch (err) {
			if (err instanceof SockaWireError) {
				await this.reportValidationError(err, originalWire);
				return;
			}
			throw err;
		}

		switch (decoded.kind) {
			case "clientRequest":
				await this.dispatchClientRequest(decoded.frame, originalWire);
				return;
			case "serverResponse":
			case "serverError":
			case "serverEvent":
				await this.reportValidationError(
					new Error("socka: unexpected server-originated frame from client"),
					parsed,
				);
				return;
			default:
				exhaustiveGuard(decoded);
		}
	}

	private async dispatchClientRequest(
		frame: SockaClientRequestFrame,
		_originalWire: unknown,
	): Promise<void> {
		const rpcName = frame.rpc;
		const procedure = this.config.contract.calls[rpcName];

		if (!procedure) {
			const errorFrame = encodeServerError(
				frame.id,
				`Unknown call: ${rpcName}`,
				{ rpc: rpcName },
			);
			this.sendWireFrame(errorFrame);
			return;
		}

		let validatedInput: unknown;
		if (procedure.input) {
			try {
				validatedInput = await parseStandardSchema(procedure.input, frame.body);
			} catch (err) {
				const msg =
					err instanceof Error ? err.message : "Input validation failed";
				const errorFrame = encodeServerError(frame.id, msg, {
					rpc: rpcName,
				});
				this.sendWireFrame(errorFrame);
				return;
			}
		}

		let result: unknown;
		try {
			if (procedure.input) {
				const handler = this.config.handlers[rpcName] as (
					input: unknown,
					s: SockaWebSocketSession<TContract, TData>,
				) => unknown | Promise<unknown>;
				result = await handler(validatedInput, this);
			} else {
				const handler = this.config.handlers[rpcName] as (
					s: SockaWebSocketSession<TContract, TData>,
				) => unknown | Promise<unknown>;
				result = await handler(this);
			}
		} catch (err) {
			this.config.onHandlerError?.(err, rpcName, validatedInput, this);
			const sockaErr =
				err instanceof SockaError
					? err
					: new SockaError(
							err instanceof Error ? err.message : "Handler failed",
						);
			const errorFrame = encodeServerError(frame.id, sockaErr.message, {
				rpc: rpcName,
				code: sockaErr.code,
				data: sockaErr.data,
			});
			this.sendWireFrame(errorFrame);
			return;
		}

		if (procedure.output === undefined) {
			return;
		}

		let validatedOutput: unknown;
		try {
			validatedOutput = await parseStandardSchema(procedure.output, result);
		} catch (err) {
			const msg =
				err instanceof Error ? err.message : "Output validation failed";
			const errorFrame = encodeServerError(frame.id, msg, { rpc: rpcName });
			this.sendWireFrame(errorFrame);
			return;
		}

		const responseFrame = encodeServerResponse(
			frame.id,
			rpcName,
			validatedOutput,
		);
		this.sendWireFrame(responseFrame);
	}

	private encodeOutgoing(frame: SockaWireFrame): string | Uint8Array {
		return encodeSockaWire(
			frame,
			this.wireFormat,
			this.config.serializeJson ?? JSON.stringify,
		);
	}

	private sendWireFrame(frame: SockaWireFrame): void {
		if (this.websocket.readyState !== WebSocket.OPEN) {
			return;
		}
		const encoded = this.encodeOutgoing(frame);
		if (typeof encoded === "string") {
			this.websocket.send(encoded);
			return;
		}
		const copy = new Uint8Array(encoded.byteLength);
		copy.set(encoded);
		this.websocket.send(copy.buffer);
	}

	/**
	 * Send a server event frame (wire). Prefer {@link emitPush} so
	 * payloads are validated against the contract.
	 */
	public emitWireEvent(event: string, body: unknown): void {
		const frame = encodeServerEvent(event, body);
		this.sendWireFrame(frame);
	}

	public async emitPush<K extends keyof TContract["pushes"] & string>(
		name: K,
		body: InferSockaPushPayload<TContract, K>,
	): Promise<void> {
		const schema = this.config.contract.pushes[name];
		if (!schema) {
			throw new Error(`socka: unknown push ${String(name)}`);
		}
		const validated = await parseStandardSchema(
			schema as StandardSchemaV1<unknown, InferSockaPushPayload<TContract, K>>,
			body,
		);
		this.emitWireEvent(name, validated);
	}

	public async broadcastPush<K extends keyof TContract["pushes"] & string>(
		name: K,
		body: InferSockaPushPayload<TContract, K>,
		excludeSelf = false,
	): Promise<void> {
		const schema = this.config.contract.pushes[name];
		if (!schema) {
			throw new Error(`socka: unknown push ${String(name)}`);
		}
		const validated = await parseStandardSchema(
			schema as StandardSchemaV1<unknown, InferSockaPushPayload<TContract, K>>,
			body,
		);
		broadcastSockaEventToPeers(
			this.sessions,
			this,
			name,
			validated,
			excludeSelf,
		);
	}

	private async reportValidationError(
		error: unknown,
		originalMessage: unknown,
	): Promise<void> {
		if (this.config.onValidationError) {
			await this.config.onValidationError(error, originalMessage);
		} else {
			console.error("socka: validation error:", error, originalMessage);
		}
	}
}

/**
 * Invoke {@link SockaWebSocketSessionConfig.onAttached} after the session is
 * registered in the shared map.
 */
export function runSockaSessionOnAttached<
	TContract extends SockaContractBound,
	TData,
>(
	config: SockaWebSocketSessionConfigUnion<TContract, TData>,
	session: SockaWebSocketSession<TContract, TData>,
): void {
	const cb = config.onAttached;
	if (!cb) return;
	try {
		const result = cb(session);
		void Promise.resolve(result).catch((error: unknown) => {
			reportSockaError(config.reportError, {
				kind: "serverOnAttached",
				error,
			});
		});
	} catch (error) {
		reportSockaError(config.reportError, { kind: "serverOnAttached", error });
	}
}
