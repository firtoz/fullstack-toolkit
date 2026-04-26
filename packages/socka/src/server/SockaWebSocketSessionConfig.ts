import type { SockaContractBound, InferSockaHandlers } from "../core/contract";
import type { SockaReportError } from "../core/socka-report-error";
import type { SockaWireFormat } from "../core/wire-codec";

/** Session data with no fields — `createData` may be omitted (defaults to `{}`). */
type EmptySockaSessionData = Record<string, never>;

/**
 * Upgrade context passed into `createData` for {@link SockaWebSocketSession} when
 * **`strictUpgradeRequest: false`** is set (opt out of the default strict upgrade).
 *
 * **`request` is optional** because some call sites attach a socket without an HTTP upgrade
 * (custom tests, unusual adapters, Node **`ws`** without a **`Request`**, inner DO engine).
 * If you read query params or headers from the upgrade, either handle a missing
 * **`request`** here, or use the default strict mode (omit **`strictUpgradeRequest: false`**)
 * so {@link SockaStrictWebSocketInit} applies.
 */
export type SockaWebSocketInit = {
	/**
	 * Original HTTP **`Request`** for the WebSocket upgrade, when the adapter supplies it
	 * (e.g. the optional fourth argument to **`attachSockaWebSocket`**).
	 */
	request?: Request;
};

/**
 * Upgrade context for {@link SockaWebSocketSession} when using the default strict config
 * ({@link SockaWebSocketSessionConfig} — no `strictUpgradeRequest` field).
 *
 * **What this enables:** `createData` is typed so **`init.request` is always defined**.
 * You can use **`new URL(init.request.url)`**, read search params, and use **`Request`**
 * headers without optional chaining or a dummy base URL for **`URL`** parsing.
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
	TContract extends SockaContractBound,
	TData,
> = import("./SockaWebSocketSession").SockaWebSocketSession<TContract, TData>;

type SockaWebSocketSessionConfigBase<
	TContract extends SockaContractBound,
	TData,
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
};

/**
 * Configuration for {@link SockaWebSocketSession} — **default (strict upgrade)**.
 *
 * Handlers receive the session as the second argument, or the only argument when the call
 * has no input schema.
 *
 * **`createData`** receives {@link SockaStrictWebSocketInit}: **`init.request`** is the
 * HTTP upgrade **`Request`**, required in TypeScript and enforced at runtime. Use for
 * normal Bun/Hono apps and **`attachSockaWebSocket(websocket, sessions, config, { request })`**.
 *
 * Bun helpers: store **`request`** on **`ServerWebSocket`** `data` and use
 * **`sockaBunInitFromWsData`** (see **`@firtoz/socka/bun`**). Hono: **`sockaHonoNodeWs`** /
 * **`sockaHonoCloudflare`** can supply **`sockaInit`** from the context so **`createData`**
 * still sees a **`Request`**.
 *
 * To allow a missing upgrade **`Request`** (tests, Node **`ws`**, inner DO engine), use
 * {@link SockaWebSocketSessionConfigLoose} instead. See the **Server** guide section
 * **Strict upgrade request** in the package docs.
 */
export type SockaWebSocketSessionConfig<
	TContract extends SockaContractBound,
	TData = EmptySockaSessionData,
> = SockaWebSocketSessionConfigBase<TContract, TData> &
	SockaWebSocketCreateDataStrict<TData>;

/**
 * Configuration for {@link SockaWebSocketSession} — **loose upgrade** (opt out of strict).
 *
 * Sets **`strictUpgradeRequest: false`**. **`createData`** receives {@link SockaWebSocketInit};
 * **`init.request` may be `undefined`**.
 *
 * Use when:
 *
 * - Custom **`attachSockaWebSocket`** call sites or tests that do not attach an HTTP
 *   **`Request`**
 * - Node **`ws`** or other adapters where you only have a **`WebSocket`**
 * - The inner **`SockaWebSocketSession`** constructed inside **`SockaDoSession`** (socka sets
 *   this mode for you)
 *
 * If you read query params or headers from the upgrade, guard for a missing **`request`**
 * or switch to {@link SockaWebSocketSessionConfig} and wire the real **`Request`** through.
 */
export type SockaWebSocketSessionConfigLoose<
	TContract extends SockaContractBound,
	TData = EmptySockaSessionData,
> = SockaWebSocketSessionConfigBase<TContract, TData> & {
	strictUpgradeRequest: false;
} & SockaWebSocketCreateData<TData>;

/**
 * Union of {@link SockaWebSocketSessionConfig} (strict) and {@link SockaWebSocketSessionConfigLoose}.
 * This is the type accepted by {@link SockaWebSocketSession}'s constructor,
 * **`attachSockaWebSocket`**, **`createSockaBunWebSocketHandlers`**, and Hono socka helpers.
 */
export type SockaWebSocketSessionConfigUnion<
	TContract extends SockaContractBound,
	TData = EmptySockaSessionData,
> =
	| SockaWebSocketSessionConfig<TContract, TData>
	| SockaWebSocketSessionConfigLoose<TContract, TData>;
