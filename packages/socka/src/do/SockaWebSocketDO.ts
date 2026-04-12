import type { Context } from "hono";
import type { SessionEnv } from "@firtoz/websocket-do";
import { BaseWebSocketDO } from "@firtoz/websocket-do";
import type { SockaContract, SockaContractConfig } from "../core/contract";
import type { SockaDoSession } from "./SockaDoSession";

export type SockaWebSocketDOOptions<
	TEnv extends object,
	TSession extends SockaDoSession<
		SockaContract<SockaContractConfig>,
		unknown,
		TEnv
	>,
> = {
	createSockaSession: (
		ctx: Context<{ Bindings: TEnv }> | undefined,
		websocket: WebSocket,
	) => TSession | Promise<TSession>;
};

/**
 * Durable Object base class for WebSocket apps using {@link SockaDoSession}
 * (Standard Schema contract-driven).
 */
export abstract class SockaWebSocketDO<
	TSession extends SockaDoSession<
		SockaContract<SockaContractConfig>,
		// biome-ignore lint/suspicious/noExplicitAny: session family type erasure
		any,
		// biome-ignore lint/suspicious/noExplicitAny: session family type erasure
		any
		// biome-ignore lint/suspicious/noExplicitAny: session family type erasure
	> = SockaDoSession<SockaContract<SockaContractConfig>, any, any>,
	TEnv extends SessionEnv<TSession> = SessionEnv<TSession>,
> extends BaseWebSocketDO<TSession, TEnv> {
	constructor(
		ctx: DurableObjectState,
		env: TEnv,
		options: SockaWebSocketDOOptions<TEnv, TSession>,
	) {
		super(ctx, env, {
			createSession: (sessionCtx, websocket) =>
				options.createSockaSession(sessionCtx, websocket),
		});
	}
}
