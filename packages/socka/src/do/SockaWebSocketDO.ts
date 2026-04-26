import type { Context } from "hono";
import type { SessionEnv } from "@firtoz/websocket-do";
import { BaseWebSocketDO } from "@firtoz/websocket-do";
import type { SockaContractBound } from "../core/contract";
import type { SockaDoSession } from "./SockaDoSession";

export type SockaWebSocketDOOptions<
	TEnv extends object,
	/**
	 * `any` for the contract type parameter: `SockaDoSession` is invariant, so
	 * `SockaDoSession<typeof myContract, …>` is not a subtype of
	 * `SockaDoSession<SockaContractBound, …>` for `extends` even when `myContract` is
	 * a valid `SockaContractBound`. Use a concrete `SockaDoSession` subclass as `TSession`.
	 */
	TSession extends SockaDoSession<
		// biome-ignore lint/suspicious/noExplicitAny: SockaDoSession is invariant in TContract
		any,
		// biome-ignore lint/suspicious/noExplicitAny: session family type erasure
		any,
		TEnv
	>,
> = {
	createSockaSession: (
		ctx: Context<{ Bindings: TEnv }> | undefined,
		websocket: WebSocket,
	) => TSession | Promise<TSession>;
	/** Same as `pairServerWebSocketAcceptOptions` on `BaseWebSocketDOOptions` from `@firtoz/websocket-do`. */
	pairServerWebSocketAcceptOptions?: WebSocketAcceptOptions;
};

/**
 * Durable Object base class for WebSocket apps using {@link SockaDoSession}
 * (Standard Schema contract-driven).
 */
export abstract class SockaWebSocketDO<
	TSession extends SockaDoSession<
		// biome-ignore lint/suspicious/noExplicitAny: session family type erasure
		any,
		// biome-ignore lint/suspicious/noExplicitAny: session family type erasure
		any,
		// biome-ignore lint/suspicious/noExplicitAny: session family type erasure
		any
	> = SockaDoSession<
		SockaContractBound,
		// biome-ignore lint/suspicious/noExplicitAny: session family type erasure
		any,
		// biome-ignore lint/suspicious/noExplicitAny: session family type erasure
		any
	>,
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
			pairServerWebSocketAcceptOptions:
				options.pairServerWebSocketAcceptOptions,
		});
	}
}
