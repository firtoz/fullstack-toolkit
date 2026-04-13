import type { Context } from "hono";
import type { WSEvents } from "hono/ws";
import type { WebSocket as NodeWebSocket } from "ws";
import type { SockaContract, SockaContractConfig } from "../core/contract";
import { reportSockaError } from "../core/socka-report-error";
import type { SockaWireFormat } from "../core/wire-codec";
import { dispatchSockaInboundMessage } from "../server/dispatchSockaInboundMessage";
import {
	SockaWebSocketSession,
	runSockaSessionOnAttached,
	type SockaWebSocketInit,
	type SockaWebSocketSessionConfig,
} from "../server/SockaWebSocketSession";

export type SockaHonoNodeWsOptions<
	TContract extends SockaContract<SockaContractConfig>,
	TData,
> = {
	/** Shared map; default is a new `Map`. */
	sessions?: Map<WebSocket, SockaWebSocketSession<TContract, TData>>;
	/** Per-upgrade init for `createData` (e.g. `{ request: c.req.raw }` when it is a `Request`). */
	sockaInit?: (c: Context) => SockaWebSocketInit | undefined;
};

/**
 * Returns the callback passed to `upgradeWebSocket` from
 * {@link https://github.com/honojs/middleware/tree/main/packages/node-ws @hono/node-ws}
 * `createNodeWebSocket({ app }).upgradeWebSocket`.
 */
export function sockaHonoNodeWs<
	TContract extends SockaContract<SockaContractConfig>,
	TData,
>(
	config: SockaWebSocketSessionConfig<TContract, TData>,
	options?: SockaHonoNodeWsOptions<TContract, TData>,
): (c: Context) => WSEvents<NodeWebSocket> {
	const sessions =
		options?.sessions ??
		new Map<WebSocket, SockaWebSocketSession<TContract, TData>>();
	const wireFormat: SockaWireFormat = config.wireFormat ?? "json";

	return (c: Context) => ({
		onOpen(_evt, wsCtx) {
			const raw = wsCtx.raw;
			if (!raw) return;
			const domWs = raw as unknown as WebSocket;
			const init = options?.sockaInit?.(c);
			const session = new SockaWebSocketSession(domWs, sessions, config, init);
			sessions.set(domWs, session);
			runSockaSessionOnAttached(config, session);
		},
		onMessage(evt, wsCtx) {
			const raw = wsCtx.raw;
			if (!raw) return;
			const domWs = raw as unknown as WebSocket;
			const session = sessions.get(domWs);
			if (!session) return;
			void dispatchSockaInboundMessage(session, wireFormat, evt.data).catch(
				(error: unknown) => {
					reportSockaError(config.reportError, {
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
				try {
					await config.handleClose();
				} catch (error) {
					reportSockaError(config.reportError, {
						kind: "serverHandleClose",
						error,
					});
				} finally {
					sessions.delete(domWs);
				}
			})().catch((error: unknown) => {
				reportSockaError(config.reportError, {
					kind: "serverShutdown",
					adapter: "hono",
					error,
				});
			});
		},
	});
}
