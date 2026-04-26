import type { Context } from "hono";
import type { WSEvents } from "hono/ws";
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

export type SockaHonoCloudflareOptions<
	TContract extends SockaContractBound,
	TData,
> = {
	sessions?: Map<WebSocket, SockaWebSocketSession<TContract, TData>>;
	sockaInit?: (c: Context) => SockaWebSocketInit | undefined;
	resolveScope?: (c: Context) => {
		sessions: Map<WebSocket, SockaWebSocketSession<TContract, TData>>;
		config: SockaWebSocketSessionConfigUnion<TContract, TData>;
	};
};

/**
 * Callback for `upgradeWebSocket` from `hono/cloudflare-workers` (no `onOpen`;
 * the session is created on first `onMessage`).
 */
export function sockaHonoCloudflare<
	TContract extends SockaContractBound,
	TData,
>(
	config: SockaWebSocketSessionConfigUnion<TContract, TData>,
	options?: SockaHonoCloudflareOptions<TContract, TData>,
): (c: Context) => Omit<WSEvents<WebSocket>, "onOpen"> {
	const staticSessions =
		options?.sessions ??
		new Map<WebSocket, SockaWebSocketSession<TContract, TData>>();
	const staticConfig = config;
	const resolveScope = options?.resolveScope;

	return (c: Context) => ({
		onMessage(evt, wsCtx) {
			const raw = wsCtx.raw;
			if (!raw) return;
			const domWs = raw as WebSocket;
			const { sessions, config: scopeConfig } = resolveScope
				? resolveScope(c)
				: { sessions: staticSessions, config: staticConfig };
			let session = sessions.get(domWs);
			const cfg = scopeConfig as SockaWebSocketSessionConfigUnion<
				TContract,
				TData
			>;
			if (!session) {
				const init: SockaWebSocketInit | undefined =
					options?.sockaInit?.(c) ?? sockaHonoStrictInitFromContext(c);
				session = new SockaWebSocketSession(domWs, sessions, cfg, init);
				sessions.set(domWs, session);
				runSockaSessionOnAttached(cfg, session);
			}
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
			const domWs = raw as WebSocket;
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
