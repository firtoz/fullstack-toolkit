import type { SockaContract, SockaContractConfig } from "../core/contract";
import {
	SockaWireError,
	decodeSockaWire,
	encodeClientRequest,
} from "../core/envelope";
import type {
	SockaServerResponseFrame,
	SockaServerErrorFrame,
	SockaServerEventFrame,
} from "../core/envelope";
import {
	encodeSockaWire,
	parseWirePayload,
	type SockaWireFormat,
} from "../core/wire-codec";

export interface SockaWebSocketClientOptions<
	TContract extends SockaContract<SockaContractConfig>,
> {
	contract: TContract;
	/** Default `"json"` (text frames). Use `"msgpack"` for binary `ArrayBuffer` frames. */
	wireFormat?: SockaWireFormat;
	url?: string;
	webSocket?: WebSocket;
	/**
	 * When `false`, the socket is not created until {@link SockaWebSocketClient.connect}
	 * (or the first operation that implicitly opens, e.g. {@link SockaSession} `send`).
	 * Default `true`.
	 */
	autoConnect?: boolean;
	serializeJson?: (value: unknown) => string;
	deserializeJson?: (raw: string) => unknown;
	onOpen?: (event: Event) => void;
	onClose?: (event: CloseEvent) => void;
	onError?: (event: Event) => void;
	onResponse?: (frame: SockaServerResponseFrame) => void;
	onServerError?: (frame: SockaServerErrorFrame) => void;
	onEvent?: (frame: SockaServerEventFrame) => void;
	onValidationError?: (error: Error, rawMessage: unknown) => void;
	/**
	 * Automatic reconnect after an abnormal close. **Disabled by default** when
	 * {@link webSocket} is injected (tests); enabled when using {@link url}.
	 * Pass `false` to disable.
	 */
	reconnect?: false | SockaReconnectConfig;
	/** Fired before a reconnect attempt is scheduled (after delay is chosen). */
	onReconnecting?: (info: SockaReconnectingInfo) => void;
	/** Fired after a new socket reaches `open` following a reconnect. */
	onReconnected?: (info: SockaReconnectedInfo) => void;
}

/** Options for {@link SockaWebSocketClientOptions.reconnect}. */
export type SockaReconnectConfig = {
	/** Default `1000`. */
	initialDelayMs?: number;
	/** Default `30000`. */
	maxDelayMs?: number;
	/** 0–1 fraction of delay to randomize. Default `0.2`. */
	jitter?: number;
	/** Omit for infinite attempts. */
	maxAttempts?: number;
	/**
	 * When `true` (default), delay reconnect until `document` is visible again.
	 */
	pauseWhenHidden?: boolean;
};

export type SockaReconnectingInfo = {
	attempt: number;
	delayMs: number;
};

export type SockaReconnectedInfo = {
	attempt: number;
};

/**
 * Browser WebSocket client driven by a socka contract. Sends client request
 * frames and dispatches decoded server frames to callbacks.
 */
export class SockaWebSocketClient<
	TContract extends SockaContract<SockaContractConfig>,
> {
	private ws: WebSocket | undefined;
	private readonly opts: SockaWebSocketClientOptions<TContract>;
	private readonly wireFormat: SockaWireFormat;
	private readonly serializeJson: (value: unknown) => string;
	private readonly deserializeJson: (raw: string) => unknown;
	private readonly onResponseCb?: (frame: SockaServerResponseFrame) => void;
	private readonly onServerErrorCb?: (frame: SockaServerErrorFrame) => void;
	private readonly onEventCb?: (frame: SockaServerEventFrame) => void;
	private readonly onValidationError?: (
		error: Error,
		rawMessage: unknown,
	) => void;

	readonly contract: TContract;

	private manualClose = false;
	private reconnectAttempt = 0;
	private reconnectTimer: ReturnType<typeof setTimeout> | undefined;

	constructor(options: SockaWebSocketClientOptions<TContract>) {
		this.opts = options;
		this.contract = options.contract;
		this.wireFormat = options.wireFormat ?? "json";
		this.serializeJson = options.serializeJson ?? JSON.stringify;
		this.deserializeJson = options.deserializeJson ?? JSON.parse;
		this.onResponseCb = options.onResponse;
		this.onServerErrorCb = options.onServerError;
		this.onEventCb = options.onEvent;
		this.onValidationError = options.onValidationError;

		if (options.autoConnect !== false) {
			this.attachSocket(this.createSocket());
		}
	}

	private createSocket(): WebSocket {
		if (this.opts.webSocket) {
			return this.opts.webSocket;
		}
		if (this.opts.url) {
			return new WebSocket(this.opts.url);
		}
		throw new Error("Either 'url' or 'webSocket' must be provided");
	}

	private attachSocket(ws: WebSocket): void {
		this.ws = ws;
		if (this.wireFormat === "msgpack") {
			ws.binaryType = "arraybuffer";
		}

		ws.addEventListener("open", (event) => {
			const prev = this.reconnectAttempt;
			this.reconnectAttempt = 0;
			if (prev > 0) {
				this.opts.onReconnected?.({ attempt: prev });
			}
			this.opts.onOpen?.(event);
		});

		ws.addEventListener("message", (event) => {
			this.handleMessageEvent(event);
		});

		ws.addEventListener("close", (event) => {
			this.opts.onClose?.(event);
			this.maybeScheduleReconnect();
		});

		ws.addEventListener("error", (event) => {
			this.opts.onError?.(event);
		});
	}

	private getReconnectEnabled(): boolean {
		if (this.opts.reconnect === false) return false;
		if (
			this.opts.webSocket !== undefined &&
			this.opts.reconnect === undefined
		) {
			return false;
		}
		return this.opts.url !== undefined;
	}

	private resolveReconnectConfig(): SockaReconnectConfig {
		const r = this.opts.reconnect;
		if (r === false) return {};
		return r ?? {};
	}

	private computeReconnectDelayMs(
		attempt: number,
		cfg: SockaReconnectConfig,
	): number {
		const initial = cfg.initialDelayMs ?? 1000;
		const max = cfg.maxDelayMs ?? 30000;
		const jitterRatio = cfg.jitter ?? 0.2;
		const base = Math.min(max, initial * 2 ** Math.max(0, attempt - 1));
		const spread = base * jitterRatio;
		return Math.max(0, base + (Math.random() * 2 - 1) * spread);
	}

	private maybeScheduleReconnect(): void {
		if (this.manualClose) return;
		if (!this.getReconnectEnabled()) return;
		const cfg = this.resolveReconnectConfig();
		const maxAttempts = cfg.maxAttempts;
		if (maxAttempts !== undefined && this.reconnectAttempt >= maxAttempts) {
			return;
		}
		if (
			cfg.pauseWhenHidden !== false &&
			typeof document !== "undefined" &&
			document.hidden
		) {
			const onVis = (): void => {
				if (!document.hidden) {
					document.removeEventListener("visibilitychange", onVis);
					this.maybeScheduleReconnect();
				}
			};
			document.addEventListener("visibilitychange", onVis);
			return;
		}
		this.reconnectAttempt += 1;
		const delayMs = this.computeReconnectDelayMs(this.reconnectAttempt, cfg);
		this.opts.onReconnecting?.({ attempt: this.reconnectAttempt, delayMs });
		if (this.reconnectTimer !== undefined) {
			clearTimeout(this.reconnectTimer);
		}
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = undefined;
			if (this.manualClose) return;
			this.openReplacementSocket();
		}, delayMs);
	}

	private openReplacementSocket(): void {
		if (this.manualClose) return;
		if (!this.opts.url) return;
		this.ws = undefined;
		this.attachSocket(this.createSocket());
	}

	private handleMessageEvent(event: MessageEvent): void {
		try {
			const fmt = this.wireFormat;
			let payload: string | ArrayBuffer;
			if (fmt === "json") {
				if (typeof event.data !== "string") {
					this.onValidationError?.(
						new Error("socka: expected JSON text frame"),
						event.data,
					);
					return;
				}
				payload = event.data;
			} else {
				if (!(event.data instanceof ArrayBuffer)) {
					this.onValidationError?.(
						new Error("socka: expected ArrayBuffer msgpack frame"),
						event.data,
					);
					return;
				}
				payload = event.data;
			}

			let parsed: unknown;
			try {
				parsed = parseWirePayload(payload, fmt, this.deserializeJson);
			} catch (err) {
				this.onValidationError?.(
					err instanceof Error ? err : new Error(String(err)),
					event.data,
				);
				return;
			}

			let decoded: ReturnType<typeof decodeSockaWire>;
			try {
				decoded = decodeSockaWire(parsed);
			} catch (err) {
				if (err instanceof SockaWireError) {
					this.onValidationError?.(err, parsed);
					return;
				}
				throw err;
			}
			switch (decoded.kind) {
				case "serverResponse":
					this.onResponseCb?.(decoded.frame);
					break;
				case "serverError":
					this.onServerErrorCb?.(decoded.frame);
					break;
				case "serverEvent":
					this.onEventCb?.(decoded.frame);
					break;
				case "clientRequest":
					this.onValidationError?.(
						new Error("socka: unexpected clientRequest frame from server"),
						parsed,
					);
					break;
				default: {
					const _exhaustive: never = decoded;
					throw new Error(
						`socka: unexpected wire decode branch ${JSON.stringify(_exhaustive)}`,
					);
				}
			}
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			this.onValidationError?.(err, event.data);
		}
	}

	/**
	 * Creates the WebSocket (when {@link SockaWebSocketClientOptions.autoConnect}
	 * was `false`) and waits until the connection is open.
	 */
	async connect(): Promise<void> {
		if (!this.ws) {
			this.attachSocket(this.createSocket());
		}
		await this.waitForOpen();
	}

	sendRequest(id: string, rpc: string, body: Record<string, unknown>): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			throw new Error("WebSocket is not open");
		}
		const frame = encodeClientRequest(id, rpc, body);
		const encoded = encodeSockaWire(frame, this.wireFormat, this.serializeJson);
		if (typeof encoded === "string") {
			this.ws.send(encoded);
			return;
		}
		const copy = new Uint8Array(encoded.byteLength);
		copy.set(encoded);
		this.ws.send(copy.buffer);
	}

	close(code?: number, reason?: string): void {
		this.manualClose = true;
		if (this.reconnectTimer !== undefined) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = undefined;
		}
		this.ws?.close(code, reason);
	}

	get readyState(): number {
		return this.ws?.readyState ?? WebSocket.CONNECTING;
	}

	get socket(): WebSocket {
		if (!this.ws) {
			throw new Error(
				"socka: WebSocket not created yet; call connect() first or use autoConnect: true",
			);
		}
		return this.ws;
	}

	async waitForOpen(): Promise<void> {
		const ws = this.ws;
		if (!ws) {
			throw new Error(
				"socka: WebSocket not created yet; call connect() first or use autoConnect: true",
			);
		}
		if (ws.readyState === WebSocket.OPEN) {
			return;
		}
		return new Promise((resolve, reject) => {
			const abortController = new AbortController();
			const { signal } = abortController;
			const cleanup = () => {
				abortController.abort();
			};
			ws.addEventListener(
				"open",
				() => {
					cleanup();
					resolve();
				},
				{ signal },
			);
			ws.addEventListener(
				"error",
				() => {
					cleanup();
					reject(new Error("WebSocket connection failed"));
				},
				{ signal },
			);
		});
	}
}
