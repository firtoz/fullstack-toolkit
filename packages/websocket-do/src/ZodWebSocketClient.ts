import { pack, unpack } from "msgpackr";
import type { ZodType } from "zod";

export interface ZodWebSocketClientOptions<TClientMessage, TServerMessage> {
	/**
	 * URL to connect to (required if webSocket not provided)
	 */
	url?: string;
	/**
	 * Existing WebSocket to wrap (alternative to url)
	 * Useful when getting a WebSocket from honoDoFetcher
	 */
	webSocket?: WebSocket;
	clientSchema: ZodType<TClientMessage>;
	serverSchema: ZodType<TServerMessage>;
	enableBufferMessages?: boolean;
	onMessage?: (message: TServerMessage) => void;
	onOpen?: (event: Event) => void;
	onClose?: (event: CloseEvent) => void;
	onError?: (event: Event) => void;
	onValidationError?: (error: Error, rawMessage: unknown) => void;
}

export class ZodWebSocketClient<TClientMessage, TServerMessage> {
	private ws: WebSocket;
	private readonly clientSchema: ZodType<TClientMessage>;
	private readonly serverSchema: ZodType<TServerMessage>;
	private readonly enableBufferMessages: boolean;
	private readonly onMessageCallback?: (message: TServerMessage) => void;
	private readonly onValidationError?: (
		error: Error,
		rawMessage: unknown,
	) => void;

	constructor(
		options: ZodWebSocketClientOptions<TClientMessage, TServerMessage>,
	) {
		this.clientSchema = options.clientSchema;
		this.serverSchema = options.serverSchema;
		this.enableBufferMessages = options.enableBufferMessages ?? false;
		this.onMessageCallback = options.onMessage;
		this.onValidationError = options.onValidationError;

		// Use provided WebSocket or create new one from URL
		if (options.webSocket) {
			// Use existing WebSocket (e.g., from honoDoFetcher)
			this.ws = options.webSocket;
		} else if (options.url) {
			// Create new WebSocket from URL
			this.ws = new WebSocket(options.url);
		} else {
			throw new Error("Either 'url' or 'webSocket' must be provided");
		}

		// Set binary type for buffer messages
		if (this.enableBufferMessages) {
			this.ws.binaryType = "arraybuffer";
		}

		// Setup event handlers
		this.ws.addEventListener("open", (event) => {
			options.onOpen?.(event);
		});

		this.ws.addEventListener("message", (event) => {
			this.handleMessage(event);
		});

		this.ws.addEventListener("close", (event) => {
			options.onClose?.(event);
		});

		this.ws.addEventListener("error", (event) => {
			options.onError?.(event);
		});
	}

	private handleMessage(event: MessageEvent): void {
		try {
			let parsedMessage: TServerMessage;

			if (this.enableBufferMessages) {
				// Buffer mode: expect ArrayBuffer
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

				// Unpack and validate
				const unpacked = unpack(new Uint8Array(event.data));
				parsedMessage = this.serverSchema.parse(unpacked);
			} else {
				// JSON mode: expect string
				if (typeof event.data !== "string") {
					console.error("Expected string but received:", typeof event.data);
					this.onValidationError?.(
						new Error("Expected string in JSON mode"),
						event.data,
					);
					return;
				}

				// Parse and validate
				const parsed = JSON.parse(event.data);
				parsedMessage = this.serverSchema.parse(parsed);
			}

			// Call message handler
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
	 * Send a message (automatically encodes based on mode)
	 */
	send(message: TClientMessage): void {
		try {
			// Validate message
			const validatedMessage = this.clientSchema.parse(message);

			if (this.enableBufferMessages) {
				// Encode as msgpack
				const packed = pack(validatedMessage);
				this.ws.send(packed);
			} else {
				// Encode as JSON
				this.ws.send(JSON.stringify(validatedMessage));
			}
		} catch (error) {
			console.error("Failed to send message:", error);
			throw error;
		}
	}

	/**
	 * Close the WebSocket connection
	 */
	close(code?: number, reason?: string): void {
		this.ws.close(code, reason);
	}

	/**
	 * Get the current WebSocket ready state
	 */
	get readyState(): number {
		return this.ws.readyState;
	}

	/**
	 * Get the underlying WebSocket instance (use with caution)
	 */
	get socket(): WebSocket {
		return this.ws;
	}

	/**
	 * Wait for the connection to open
	 */
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
