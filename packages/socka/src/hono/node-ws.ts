import type { Context } from "hono";
import type { WSEvents } from "hono/ws";
import type { WebSocket as NodeWebSocket } from "ws";
import type { SockaContractBound } from "../core/contract";
import { reportSockaError } from "../core/socka-report-error";
import type { SockaWireFormat } from "../core/wire-codec";
import { dispatchSockaInboundMessage } from "../server/dispatchSockaInboundMessage";
import {
	SockaWebSocketSession,
	runSockaSessionOnAttached,
	type SockaWebSocketInit,
	type SockaWebSocketSessionConfigUnion,
} from "../server/SockaWebSocketSession";
import { sockaHonoStrictInitFromContext } from "./strict-init-context";

export { sockaHonoStrictInitFromContext } from "./strict-init-context";

export type SockaHonoNodeWsOptions<
	TContract extends SockaContractBound,
	TData,
> = {
	/** Shared map; default is a new `Map`. */
	sessions?: Map<WebSocket, SockaWebSocketSession<TContract, TData>>;
	/**
	 * Per-upgrade init for `createData`. When omitted, defaults to
	 * {@link sockaHonoStrictInitFromContext} so `Request` is always available.
	 */
	sockaInit?: (c: Context) => SockaWebSocketInit | undefined;
	/**
	 * Resolve the session map and config from this upgrade’s Hono context (e.g. multi-room
	 * from `c.req.param("roomId")`). When set, overrides the outer `config` / static `sessions`
	 * for each connection.
	 */
	resolveScope?: (c: Context) => {
		sessions: Map<WebSocket, SockaWebSocketSession<TContract, TData>>;
		config: SockaWebSocketSessionConfigUnion<TContract, TData>;
	};
};

/**
 * Returns the callback passed to `upgradeWebSocket` from
 * {@link https://github.com/honojs/middleware/tree/main/packages/node-ws @hono/node-ws}
 * `createNodeWebSocket({ app }).upgradeWebSocket`.
 */
export function sockaHonoNodeWs<TContract extends SockaContractBound, TData>(
	config: SockaWebSocketSessionConfigUnion<TContract, TData>,
	options?: SockaHonoNodeWsOptions<TContract, TData>,
): (c: Context) => WSEvents<NodeWebSocket> {
	const staticSessions =
		options?.sessions ??
		new Map<WebSocket, SockaWebSocketSession<TContract, TData>>();
	const staticConfig = config;
	const resolveScope = options?.resolveScope;

	return (c: Context) => ({
		onOpen(_evt, wsCtx) {
			const raw = wsCtx.raw;
			if (!raw) return;
			const domWs = raw as unknown as WebSocket;
			const { sessions, config: scopeConfig } = resolveScope
				? resolveScope(c)
				: { sessions: staticSessions, config: staticConfig };
			const init: SockaWebSocketInit | undefined =
				options?.sockaInit?.(c) ?? sockaHonoStrictInitFromContext(c);
			const cfg = scopeConfig as SockaWebSocketSessionConfigUnion<
				TContract,
				TData
			>;
			const session = new SockaWebSocketSession(domWs, sessions, cfg, init);
			sessions.set(domWs, session);
			runSockaSessionOnAttached(cfg, session);
		},
		onMessage(evt, wsCtx) {
			const raw = wsCtx.raw;
			if (!raw) return;
			const domWs = raw as unknown as WebSocket;
			const { sessions, config: scopeConfig } = resolveScope
				? resolveScope(c)
				: { sessions: staticSessions, config: staticConfig };
			const session = sessions.get(domWs);
			if (!session) return;
			const cfg = scopeConfig as SockaWebSocketSessionConfigUnion<
				TContract,
				TData
			>;
			const wireFormat: SockaWireFormat = cfg.wireFormat ?? "json";
			void dispatchSockaInboundMessage(session, wireFormat, evt.data).catch(
				(error: unknown) => {
					reportSockaError(cfg.reportError, {
						kind: "serverInboundMessage",
						adapter: "hono",
						error,
					});
				},
			);
		},
		onClose(_evt, wsCtx) {
			const raw = wsCtx.raw;
			if (!raw) return;
			const domWs = raw as unknown as WebSocket;
			void (async (): Promise<void> => {
				const { sessions, config: scopeConfig } = resolveScope
					? resolveScope(c)
					: { sessions: staticSessions, config: staticConfig };
				const cfg = scopeConfig as SockaWebSocketSessionConfigUnion<
					TContract,
					TData
				>;
				const session = sessions.get(domWs);
				try {
					if (session) {
						await session.invokeHandleClose();
					}
				} catch (error) {
					reportSockaError(cfg.reportError, {
						kind: "serverHandleClose",
						error,
					});
				} finally {
					sessions.delete(domWs);
				}
			})().catch((error: unknown) => {
				reportSockaError(staticConfig.reportError, {
					kind: "serverShutdown",
					adapter: "hono",
					error,
				});
			});
		},
	});
}
