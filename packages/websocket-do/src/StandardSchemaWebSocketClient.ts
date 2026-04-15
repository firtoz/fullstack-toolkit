import type { StandardSchemaV1 } from "@standard-schema/spec";
import { pack, unpack } from "msgpackr";
import { parseStandardSchema } from "./parseStandardSchema";

export interface StandardSchemaWebSocketClientOptions<
	TClientMessage,
	TServerMessage,
> {
	/**
	 * URL to connect to (required if webSocket not provided)
	 */
	url?: string;
	/**
	 * Existing WebSocket to wrap (alternative to url)
	 * Useful when getting a WebSocket from honoDoFetcher
	 */
	webSocket?: WebSocket;
	clientSchema: StandardSchemaV1<unknown, TClientMessage>;
	serverSchema: StandardSchemaV1<unknown, TServerMessage>;
	serializeJson?: (value: unknown) => string;
	deserializeJson?: (raw: string) => unknown;
	enableBufferMessages?: boolean;
	onMessage?: (message: TServerMessage) => void;
	onOpen?: (event: Event) => void;
	onClose?: (event: CloseEvent) => void;
	onError?: (event: Event) => void;
	onValidationError?: (error: Error, rawMessage: unknown) => void;
}

export class StandardSchemaWebSocketClient<TClientMessage, TServerMessage> {
	private ws: WebSocket;
	private readonly clientSchema: StandardSchemaV1<unknown, TClientMessage>;
	private readonly serverSchema: StandardSchemaV1<unknown, TServerMessage>;
	private readonly serializeJson: (value: unknown) => string;
	private readonly deserializeJson: (raw: string) => unknown;
	private readonly enableBufferMessages: boolean;
	private readonly onMessageCallback?: (message: TServerMessage) => void;
	private readonly onValidationError?: (
		error: Error,
		rawMessage: unknown,
	) => void;

	constructor(
		options: StandardSchemaWebSocketClientOptions<
			TClientMessage,
			TServerMessage
		>,
	) {
		this.clientSchema = options.clientSchema;
		this.serverSchema = options.serverSchema;
		this.serializeJson = options.serializeJson ?? JSON.stringify;
		this.deserializeJson = options.deserializeJson ?? JSON.parse;
		this.enableBufferMessages = options.enableBufferMessages ?? false;
		this.onMessageCallback = options.onMessage;
		this.onValidationError = options.onValidationError;

		if (options.webSocket) {
			this.ws = options.webSocket;
		} else if (options.url) {
			this.ws = new WebSocket(options.url);
		} else {
			throw new Error("Either 'url' or 'webSocket' must be provided");
		}

		if (this.enableBufferMessages) {
			this.ws.binaryType = "arraybuffer";
		}

		this.ws.addEventListener("open", (event) => {
			options.onOpen?.(event);
		});

		this.ws.addEventListener("message", (event) => {
			void this.handleMessageEvent(event);
		});

		this.ws.addEventListener("close", (event) => {
			options.onClose?.(event);
		});

		this.ws.addEventListener("error", (event) => {
			options.onError?.(event);
		});
	}

	private async handleMessageEvent(event: MessageEvent): Promise<void> {
		try {
			let parsedMessage: TServerMessage;

			if (this.enableBufferMessages) {
				if (!(event.data instanceof ArrayBuffer)) {
					console.error(
						"Expected ArrayBuffer but received:",
						typeof event.data,
					);
					this.onValidationError?.(
						new Error("Expected ArrayBuffer in buffer mode"),
						event.data,
					);
					return;
				}

				const unpacked = unpack(new Uint8Array(event.data));
				parsedMessage = await parseStandardSchema(this.serverSchema, unpacked);
			} else {
				if (typeof event.data !== "string") {
					console.error("Expected string but received:", typeof event.data);
					this.onValidationError?.(
						new Error("Expected string in JSON mode"),
						event.data,
					);
					return;
				}

				const parsed = this.deserializeJson(event.data);
				parsedMessage = await parseStandardSchema(this.serverSchema, parsed);
			}

			this.onMessageCallback?.(parsedMessage);
		} catch (error) {
			console.error("Failed to process message:", error);
			this.onValidationError?.(
				error instanceof Error ? error : new Error(String(error)),
				event.data,
			);
		}
	}

	/**
	 * Send a message (automatically encodes based on mode).
	 */
	async send(message: TClientMessage): Promise<void> {
		const validatedMessage = await parseStandardSchema(
			this.clientSchema,
			message,
		);

		if (this.enableBufferMessages) {
			const packed = pack(validatedMessage);
			this.ws.send(new Uint8Array(packed));
		} else {
			this.ws.send(this.serializeJson(validatedMessage));
		}
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
