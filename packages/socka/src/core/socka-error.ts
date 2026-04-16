/**
 * Thrown on the server and surfaced on the client when the wire uses a shared
 * `{ type: "error", id, error }` envelope for correlated RPC failures.
 */
export class SockaError extends Error {
	readonly requestId?: string;
	/** Procedure name when provided on the wire (`serverError.rpc`). */
	readonly rpc?: string;
	readonly code?: string;
	readonly data?: unknown;

	constructor(
		message: string,
		options?: {
			requestId?: string;
			rpc?: string;
			code?: string;
			data?: unknown;
			cause?: unknown;
		},
	) {
		super(message);
		this.name = "SockaError";
		this.requestId = options?.requestId;
		this.rpc = options?.rpc;
		this.code = options?.code;
		this.data = options?.data;
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
	static fromWire(msg: {
		id: string;
		error: string;
		rpc?: string;
		code?: string;
		data?: unknown;
	}): SockaError {
		return new SockaError(msg.error, {
			requestId: msg.id,
			rpc: msg.rpc,
			code: msg.code,
			data: msg.data,
		});
	}
}
