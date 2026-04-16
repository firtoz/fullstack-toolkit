import type {
	SockaContract,
	SockaContractConfig,
	InferSockaHandlers,
} from "../core/contract";
import type { SockaReportError } from "../core/socka-report-error";
import type { SockaWireFormat } from "../core/wire-codec";

/** Session data with no fields — `createData` may be omitted (defaults to `{}`). */
type EmptySockaSessionData = Record<string, never>;

/**
 * Upgrade context passed into `createData` for {@link SockaWebSocketSession} when
 * **`strictUpgradeRequest` is not set to `true`** (the default).
 *
 * **`request` is optional** because some call sites attach a socket without an HTTP upgrade
 * (custom tests, unusual adapters). If you read query params or headers from the upgrade,
 * you must handle a missing `request` (e.g. optional chaining and a fallback URL), or set
 * **`strictUpgradeRequest: true`** instead so {@link SockaStrictWebSocketInit} applies.
 */
export type SockaWebSocketInit = {
	/**
	 * Original HTTP **`Request`** for the WebSocket upgrade, when the adapter supplies it
	 * (e.g. the optional fourth argument to **`attachSockaWebSocket`**).
	 */
	request?: Request;
};

/**
 * Upgrade context when **`strictUpgradeRequest: true`** is set on
 * {@link SockaWebSocketSessionConfig}.
 *
 * **What this enables:** `createData` is typed so **`init.request` is always defined**.
 * You can use **`new URL(init.request.url)`** and read search params without
 * `init.request?.url ?? "http://_/"` placeholders, and TypeScript will catch mistakes if you
 * treat the request as optional.
 *
 * **Runtime behavior:** If the adapter does not pass a `Request` while strict mode is on,
 * socka throws an error explaining how to wire the upgrade (e.g. Bun `data: { request: req }`,
 * or Hono default `sockaInit`).
 *
 * **Typical use:** Bun **`Bun.serve`** upgrades and Hono **`sockaHonoNodeWs`** /
 * **`sockaHonoCloudflare`** where the incoming HTTP request is available and should drive
 * `session.data` (names, cookies, etc.).
 */
export type SockaStrictWebSocketInit = {
	request: Request;
};

type SockaWebSocketCreateData<TData> = [TData] extends [EmptySockaSessionData]
	? {
			createData?: (init: SockaWebSocketInit) => TData;
		}
	: {
			createData: (init: SockaWebSocketInit) => TData;
		};

type SockaWebSocketCreateDataStrict<TData> = [TData] extends [
	EmptySockaSessionData,
]
	? {
			createData?: (init: SockaStrictWebSocketInit) => TData;
		}
	: {
			createData: (init: SockaStrictWebSocketInit) => TData;
		};

type SockaSessionForHandlers<
	TContract extends SockaContract<SockaContractConfig>,
	TData,
> = import("./SockaWebSocketSession").SockaWebSocketSession<TContract, TData>;

/**
 * Configuration for {@link SockaWebSocketSession}. Handlers receive the session
 * instance as the second argument (or the only argument when the procedure has no input).
 *
 * ## `strictUpgradeRequest` (optional flag)
 *
 * Controls how **`createData`** is typed and validated for the **HTTP upgrade**:
 *
 * - **Omitted or `undefined` (default)** — `createData` receives {@link SockaWebSocketInit}.
 *   **`init.request` may be missing.** Use this for adapters or tests that construct sessions
 *   without a real upgrade request, or when you intentionally support both cases and handle
 *   optional `request` in code.
 *
 * - **`true`** — Opt in to **strict** upgrade typing: `createData` receives
 *   {@link SockaStrictWebSocketInit}, so **`init.request` is required** in TypeScript and
 *   enforced at runtime. Prefer this for normal Bun/Hono apps that always have an upgrade
 *   `Request`, so you avoid placeholder URLs and get clearer errors if wiring is wrong.
 *
 * Bun and Hono helpers document how they populate init (e.g. **`sockaBunInitFromWsData`**,
 * default **`sockaInit`** from Hono context). The published **Server** guide includes a
 * **Strict upgrade request** section with examples.
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
	/** Called when this WebSocket closes, before the socket is removed from `sessions`. */
	handleClose: (
		session: SockaSessionForHandlers<TContract, TData>,
	) => Promise<void>;
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
	 * `console.error` with `socka:` prefixes; see `SockaReportError` in `@firtoz/socka/core`.
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
} & (
	| ({ strictUpgradeRequest?: undefined } & SockaWebSocketCreateData<TData>)
	| ({ strictUpgradeRequest: true } & SockaWebSocketCreateDataStrict<TData>)
);
