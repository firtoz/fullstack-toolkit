import type {
	SockaContract,
	SockaContractConfig,
	InferSockaHandlers,
} from "../core/contract";
import type { SockaReportError } from "../core/socka-report-error";
import type { SockaWireFormat } from "../core/wire-codec";

/** Session data with no fields — `createData` may be omitted (defaults to `{}`). */
type EmptySockaSessionData = Record<string, never>;

/** Optional upgrade context for {@link SockaWebSocketSession}. */
export type SockaWebSocketInit = {
	/** Original HTTP request for the WebSocket upgrade, when available. */
	request?: Request;
};

type SockaWebSocketCreateData<TData> = [TData] extends [EmptySockaSessionData]
	? {
			createData?: (init: SockaWebSocketInit) => TData;
		}
	: {
			createData: (init: SockaWebSocketInit) => TData;
		};

type SockaSessionForHandlers<
	TContract extends SockaContract<SockaContractConfig>,
	TData,
> = import("./SockaWebSocketSession").SockaWebSocketSession<TContract, TData>;

/**
 * Configuration for {@link SockaWebSocketSession}. Handlers receive the session
 * instance as the second argument (or the only argument when the procedure has no input).
 */
export type SockaWebSocketSessionConfig<
	TContract extends SockaContract<SockaContractConfig>,
	TData = EmptySockaSessionData,
> = {
	contract: TContract;
	/** Default `"json"`. Use `"msgpack"` for binary frames (must match client). */
	wireFormat?: SockaWireFormat;
	handlers: InferSockaHandlers<
		TContract,
		SockaSessionForHandlers<TContract, TData>
	>;
	handleClose: () => Promise<void>;
	onHandlerError?: (
		error: unknown,
		rpcName: string,
		input: unknown,
		session: SockaSessionForHandlers<TContract, TData>,
	) => void;
	onValidationError?: (
		error: unknown,
		originalMessage: unknown,
	) => Promise<void>;
	/**
	 * Optional sink for non-RPC failures (onAttached, adapter I/O). Defaults to
	 * `console.error` with `socka:` prefixes; see `SockaReportError` in `socka/core`.
	 */
	reportError?: (event: SockaReportError) => void;
	serializeJson?: (value: unknown) => string;
	deserializeJson?: (raw: string) => unknown;
	/**
	 * Called once after this session is registered in the shared `sessions` map
	 * (safe to broadcast to peers). Sync or async; async rejections are logged.
	 */
	onAttached?: (
		session: SockaSessionForHandlers<TContract, TData>,
	) => void | Promise<void>;
} & SockaWebSocketCreateData<TData>;
