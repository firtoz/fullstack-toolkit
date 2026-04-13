import type { Context } from "hono";
import type { WSEvents } from "hono/ws";
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

export type SockaHonoCloudflareOptions<
	TContract extends SockaContract<SockaContractConfig>,
	TData,
> = {
	sessions?: Map<WebSocket, SockaWebSocketSession<TContract, TData>>;
	sockaInit?: (c: Context) => SockaWebSocketInit | undefined;
};

/**
 * Callback for `upgradeWebSocket` from `hono/cloudflare-workers` (no `onOpen`;
 * the session is created on first `onMessage`).
 */
export function sockaHonoCloudflare<
	TContract extends SockaContract<SockaContractConfig>,
	TData,
>(
	config: SockaWebSocketSessionConfig<TContract, TData>,
	options?: SockaHonoCloudflareOptions<TContract, TData>,
): (c: Context) => Omit<WSEvents<WebSocket>, "onOpen"> {
	const sessions =
		options?.sessions ??
		new Map<WebSocket, SockaWebSocketSession<TContract, TData>>();
	const wireFormat: SockaWireFormat = config.wireFormat ?? "json";

	return (c: Context) => ({
		onMessage(evt, wsCtx) {
			const raw = wsCtx.raw;
			if (!raw) return;
			const domWs = raw as WebSocket;
			let session = sessions.get(domWs);
			if (!session) {
				const init = options?.sockaInit?.(c);
				session = new SockaWebSocketSession(domWs, sessions, config, init);
				sessions.set(domWs, session);
				runSockaSessionOnAttached(config, session);
			}
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
			const domWs = raw as WebSocket;
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
