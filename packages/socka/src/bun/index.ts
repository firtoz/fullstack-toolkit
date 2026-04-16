import type { ServerWebSocket } from "bun";
import type { SockaContract, SockaContractConfig } from "../core/contract";
import { reportSockaError } from "../core/socka-report-error";
import type { SockaWireFormat } from "../core/wire-codec";
import { dispatchSockaInboundMessage } from "../server/dispatchSockaInboundMessage";
import {
	SockaWebSocketSession,
	runSockaSessionOnAttached,
	type SockaStrictWebSocketInit,
	type SockaWebSocketSessionConfig,
} from "../server/SockaWebSocketSession";

/**
 * Reads the upgrade {@link Request} from Bun **`ServerWebSocket.data`** when your
 * **`fetch`** handler stored it there (e.g. **`server.upgrade(req, { data: { roomId, request: req } })`**).
 *
 * Pair with **`strictUpgradeRequest: true`** on {@link SockaWebSocketSessionConfig} so
 * **`createData`** is typed with {@link SockaStrictWebSocketInit} and **`init.request`**
 * is always defined. If **`request`** is missing from **`data`**, this returns **`undefined`**
 * and strict mode will throw when constructing the session — that usually means you forgot
 * to pass **`request`** on upgrade.
 */
export function sockaBunInitFromWsData(
	ws: ServerWebSocket<unknown>,
): SockaStrictWebSocketInit | undefined {
	const d = ws.data as Record<string, unknown> | undefined;
	if (d && "request" in d && d.request instanceof Request) {
		return { request: d.request };
	}
	return undefined;
}

export type SockaBunResolveScope<
	TContract extends SockaContract<SockaContractConfig>,
	TData,
	TWsData = undefined,
> = (ws: ServerWebSocket<TWsData>) => {
	sessionMap: Map<WebSocket, SockaWebSocketSession<TContract, TData>>;
	config: SockaWebSocketSessionConfig<TContract, TData>;
};

export type SockaBunWebSocketHandlers<
	TContract extends SockaContract<SockaContractConfig>,
	TData,
	TWsData = undefined,
> = {
	sessionMap: Map<WebSocket, SockaWebSocketSession<TContract, TData>>;
	/** Pass into `Bun.serve({ ..., websocket })`. */
	websocket: {
		open: (ws: ServerWebSocket<TWsData>) => void;
		message: (
			ws: ServerWebSocket<TWsData>,
			message: unknown,
		) => void | Promise<void>;
		close: (ws: ServerWebSocket<TWsData>) => void | Promise<void>;
	};
	wireFormat: SockaWireFormat;
};

function bunHandlersFromResolveScope<
	TContract extends SockaContract<SockaContractConfig>,
	TData,
	TWsData,
>(
	resolveScope: SockaBunResolveScope<TContract, TData, TWsData>,
): SockaBunWebSocketHandlers<TContract, TData, TWsData> {
	const websocket: SockaBunWebSocketHandlers<
		TContract,
		TData,
		TWsData
	>["websocket"] = {
		open(ws: ServerWebSocket<TWsData>) {
			const { sessionMap, config } = resolveScope(ws);
			const domWs = ws as unknown as WebSocket;
			const init = sockaBunInitFromWsData(ws);
			const session = new SockaWebSocketSession(
				domWs,
				sessionMap,
				config,
				init,
			);
			sessionMap.set(domWs, session);
			runSockaSessionOnAttached(config, session);
		},
		async message(ws: ServerWebSocket<TWsData>, message: unknown) {
			const { sessionMap, config } = resolveScope(ws);
			const domWs = ws as unknown as WebSocket;
			const session = sessionMap.get(domWs);
			if (!session) return;
			const wireFormat = config.wireFormat ?? "json";
			try {
				await dispatchSockaInboundMessage(
					session,
					wireFormat,
					message as MessageEvent["data"],
				);
			} catch (error) {
				reportSockaError(config.reportError, {
					kind: "serverInboundMessage",
					adapter: "bun",
					error,
				});
			}
		},
		async close(ws: ServerWebSocket<TWsData>) {
			const { sessionMap, config } = resolveScope(ws);
			const domWs = ws as unknown as WebSocket;
			const session = sessionMap.get(domWs);
			try {
				if (session) {
					await session.invokeHandleClose();
				}
			} catch (error) {
				reportSockaError(config.reportError, {
					kind: "serverHandleClose",
					error,
				});
			} finally {
				sessionMap.delete(domWs);
			}
		},
	};

	return {
		sessionMap: new Map(),
		websocket,
		wireFormat: "json",
	};
}

function bunHandlersFromConfig<
	TContract extends SockaContract<SockaContractConfig>,
	TData,
>(
	config: SockaWebSocketSessionConfig<TContract, TData>,
	maybeOptions?: {
		sessionMap?: Map<WebSocket, SockaWebSocketSession<TContract, TData>>;
	},
): SockaBunWebSocketHandlers<TContract, TData, undefined> {
	const sessionMap =
		maybeOptions?.sessionMap ??
		new Map<WebSocket, SockaWebSocketSession<TContract, TData>>();
	const wireFormat = config.wireFormat ?? "json";

	const websocket: SockaBunWebSocketHandlers<
		TContract,
		TData,
		undefined
	>["websocket"] = {
		open(ws: ServerWebSocket<undefined>) {
			const domWs = ws as unknown as WebSocket;
			const init = sockaBunInitFromWsData(ws);
			const session = new SockaWebSocketSession(
				domWs,
				sessionMap,
				config,
				init,
			);
			sessionMap.set(domWs, session);
			runSockaSessionOnAttached(config, session);
		},
		async message(ws: ServerWebSocket<undefined>, message: unknown) {
			const domWs = ws as unknown as WebSocket;
			const session = sessionMap.get(domWs);
			if (!session) return;
			try {
				await dispatchSockaInboundMessage(
					session,
					wireFormat,
					message as MessageEvent["data"],
				);
			} catch (error) {
				reportSockaError(config.reportError, {
					kind: "serverInboundMessage",
					adapter: "bun",
					error,
				});
			}
		},
		async close(ws: ServerWebSocket<undefined>) {
			const domWs = ws as unknown as WebSocket;
			const session = sessionMap.get(domWs);
			try {
				if (session) {
					await session.invokeHandleClose();
				}
			} catch (error) {
				reportSockaError(config.reportError, {
					kind: "serverHandleClose",
					error,
				});
			} finally {
				sessionMap.delete(domWs);
			}
		},
	};

	return { sessionMap, websocket, wireFormat };
}

/**
 * WebSocket handlers for `Bun.serve` when using `ServerWebSocket` (no
 * `addEventListener`). Inbound frames are dispatched with the same logic as
 * `attachSockaWebSocket`.
 *
 * **Single-room:** pass a {@link SockaWebSocketSessionConfig} and optional shared `sessionMap`.
 *
 * **Multi-room:** pass `{ resolveScope }` where `resolveScope(ws)` returns the
 * `sessionMap` and `config` for that socket’s scope (e.g. from `ws.data.roomId`).
 * The returned `sessionMap` is an empty placeholder; real maps come from `resolveScope`.
 */
export function createSockaBunWebSocketHandlers<
	TContract extends SockaContract<SockaContractConfig>,
	TData,
>(
	config: SockaWebSocketSessionConfig<TContract, TData>,
	options?: {
		sessionMap?: Map<WebSocket, SockaWebSocketSession<TContract, TData>>;
	},
): SockaBunWebSocketHandlers<TContract, TData, undefined>;

export function createSockaBunWebSocketHandlers<
	TContract extends SockaContract<SockaContractConfig>,
	TData,
	TWsData,
>(options: {
	resolveScope: SockaBunResolveScope<TContract, TData, TWsData>;
}): SockaBunWebSocketHandlers<TContract, TData, TWsData>;

export function createSockaBunWebSocketHandlers<
	TContract extends SockaContract<SockaContractConfig>,
	TData,
>(
	configOrOptions:
		| SockaWebSocketSessionConfig<TContract, TData>
		| { resolveScope: SockaBunResolveScope<TContract, TData, unknown> },
	maybeOptions?: {
		sessionMap?: Map<WebSocket, SockaWebSocketSession<TContract, TData>>;
	},
):
	| SockaBunWebSocketHandlers<TContract, TData, undefined>
	| SockaBunWebSocketHandlers<TContract, TData, unknown> {
	const isResolveScope =
		typeof configOrOptions === "object" &&
		configOrOptions !== null &&
		"resolveScope" in configOrOptions &&
		typeof (configOrOptions as { resolveScope: unknown }).resolveScope ===
			"function";

	if (isResolveScope) {
		return bunHandlersFromResolveScope(
			(
				configOrOptions as {
					resolveScope: SockaBunResolveScope<TContract, TData, unknown>;
				}
			).resolveScope,
		);
	}
	return bunHandlersFromConfig(
		configOrOptions as SockaWebSocketSessionConfig<TContract, TData>,
		maybeOptions,
	);
}
