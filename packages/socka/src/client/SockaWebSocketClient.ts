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
	serializeJson?: (value: unknown) => string;
	deserializeJson?: (raw: string) => unknown;
	onOpen?: (event: Event) => void;
	onClose?: (event: CloseEvent) => void;
	onError?: (event: Event) => void;
	onResponse?: (frame: SockaServerResponseFrame) => void;
	onServerError?: (frame: SockaServerErrorFrame) => void;
	onEvent?: (frame: SockaServerEventFrame) => void;
	onValidationError?: (error: Error, rawMessage: unknown) => void;
}

/**
 * Browser WebSocket client driven by a socka contract. Sends client request
 * frames and dispatches decoded server frames to callbacks.
 */
export class SockaWebSocketClient<
	TContract extends SockaContract<SockaContractConfig>,
> {
	private ws: WebSocket;
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

	constructor(options: SockaWebSocketClientOptions<TContract>) {
		this.contract = options.contract;
		this.wireFormat = options.wireFormat ?? "json";
		this.serializeJson = options.serializeJson ?? JSON.stringify;
		this.deserializeJson = options.deserializeJson ?? JSON.parse;
		this.onResponseCb = options.onResponse;
		this.onServerErrorCb = options.onServerError;
		this.onEventCb = options.onEvent;
		this.onValidationError = options.onValidationError;

		if (options.webSocket) {
			this.ws = options.webSocket;
		} else if (options.url) {
			this.ws = new WebSocket(options.url);
		} else {
			throw new Error("Either 'url' or 'webSocket' must be provided");
		}

		if (this.wireFormat === "msgpack") {
			this.ws.binaryType = "arraybuffer";
		}

		this.ws.addEventListener("open", (event) => {
			options.onOpen?.(event);
		});

		this.ws.addEventListener("message", (event) => {
			this.handleMessageEvent(event);
		});

		this.ws.addEventListener("close", (event) => {
			options.onClose?.(event);
		});

		this.ws.addEventListener("error", (event) => {
			options.onError?.(event);
		});
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

	sendRequest(id: string, rpc: string, body: Record<string, unknown>): void {
		if (this.ws.readyState !== WebSocket.OPEN) {
			throw new Error("WebSocket is not open");
		}
		const frame = encodeClientRequest(id, rpc, body);
		const encoded = encodeSockaWire(frame, this.wireFormat, this.serializeJson);
		this.ws.send(encoded);
	}

	close(code?: number, reason?: string): void {
		this.ws.close(code, reason);
	}

	get readyState(): number {
		return this.ws.readyState;
	}

	get socket(): WebSocket {
		return this.ws;
	}

	async waitForOpen(): Promise<void> {
		if (this.ws.readyState === WebSocket.OPEN) {
			return;
		}
		return new Promise((resolve, reject) => {
			const abortController = new AbortController();
			const { signal } = abortController;
			const cleanup = () => {
				abortController.abort();
			};
			this.ws.addEventListener(
				"open",
				() => {
					cleanup();
					resolve();
				},
				{ signal },
			);
			this.ws.addEventListener(
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
