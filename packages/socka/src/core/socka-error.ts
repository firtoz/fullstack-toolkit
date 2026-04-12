/**
 * Thrown on the server and surfaced on the client when the wire uses a shared
 * `{ type: "error", id, error }` envelope for correlated RPC failures.
 */
export class SockaError extends Error {
	readonly requestId?: string;
	readonly code?: string;

	constructor(
		message: string,
		options?: { requestId?: string; code?: string; cause?: unknown },
	) {
		super(message);
		this.name = "SockaError";
		this.requestId = options?.requestId;
		this.code = options?.code;
		if (options?.cause !== undefined) {
			Object.defineProperty(this, "cause", {
				value: options.cause,
				configurable: true,
				enumerable: false,
				writable: true,
			});
		}
		Object.setPrototypeOf(this, SockaError.prototype);
	}

	/** Builds a {@link SockaError} from a standard RPC error envelope. */
	static fromWire(msg: { id: string; error: string }): SockaError {
		return new SockaError(msg.error, { requestId: msg.id });
	}
}
