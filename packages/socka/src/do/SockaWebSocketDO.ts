import type { Context } from "hono";
import type { SessionEnv } from "@firtoz/websocket-do";
import { BaseWebSocketDO } from "@firtoz/websocket-do";
import type {
	InferSockaPushPayload,
	SockaContractBound,
} from "../core/contract";
import { broadcastContractPushToAll } from "../server/SockaWebSocketSession";
import type { SockaDoHost } from "./SockaDoHost";
import {
	SockaDoSession,
	type SockaDoSessionConfigInput,
} from "./SockaDoSession";

/** Session data with no fields — `createData` may be omitted (defaults to `{}`). */
type EmptySockaSessionData = Record<string, never>;

export type SockaWebSocketDOOptions = {
	/** Same as `pairServerWebSocketAcceptOptions` on `BaseWebSocketDOOptions` from `@firtoz/websocket-do`. */
	pairServerWebSocketAcceptOptions?: WebSocketAcceptOptions;
};

/**
 * Low-level DO base when {@link createSockaSession} returns a custom
 * {@link SockaDoSession} subclass. Most apps extend {@link SockaWebSocketDO}
 * instead (default session type, three type parameters).
 */
export abstract class SockaWebSocketDOBase<
	TContract extends SockaContractBound,
	TData = EmptySockaSessionData,
	TSession extends SockaDoSession<
		TContract,
		TData,
		// biome-ignore lint/suspicious/noExplicitAny: TEnv inferred from TSession via SessionEnv
		any
	> = SockaDoSession<TContract, TData, Cloudflare.Env>,
	TEnv extends SessionEnv<TSession> = SessionEnv<TSession>,
> extends BaseWebSocketDO<TSession, TEnv> {
	protected abstract readonly contract: TContract;

	constructor(
		ctx: DurableObjectState,
		env: TEnv,
		options?: SockaWebSocketDOOptions,
	) {
		super(ctx, env, {
			createSession: (sessionCtx, websocket) =>
				this.createSockaSession(sessionCtx, websocket),
			pairServerWebSocketAcceptOptions:
				options?.pairServerWebSocketAcceptOptions,
		});
	}

	/**
	 * Per-connection socka config (handlers, `createData`, lifecycle hooks).
	 * `contract` comes from {@link contract} on this host — do not repeat it here.
	 *
	 * Called on each new attach and on hibernation resume (`ctx` is `undefined`
	 * on resume). **`createData`** runs only on fresh upgrade via
	 * {@link BaseSession.startFresh}, not on {@link BaseSession.resume}.
	 */
	protected abstract buildSockaSessionConfig(
		ctx: Context<{ Bindings: TEnv }> | undefined,
	): SockaDoSessionConfigInput<TContract, TData, TEnv>;

	/**
	 * Factory for each connected WebSocket. Default: {@link SockaDoSession} wired
	 * to this host. Override when you need a {@link SockaDoSession} subclass.
	 */
	protected createSockaSession(
		ctx: Context<{ Bindings: TEnv }> | undefined,
		websocket: WebSocket,
	): TSession | Promise<TSession> {
		const host: SockaDoHost<TContract, TData, TEnv, TSession> = {
			contract: this.contract,
			sessions: this.sessions,
			buildSockaSessionConfig: (attachCtx) =>
				this.buildSockaSessionConfig(attachCtx),
		};
		return new SockaDoSession<TContract, TData, TEnv>(
			websocket,
			host,
			ctx,
		) as TSession;
	}

	/**
	 * Broadcast a contract-typed push to **every** connected session in this DO.
	 *
	 * Use from HTTP handlers, alarms, or other code paths with no originating
	 * WebSocket session. No-op when the room is empty.
	 */
	protected broadcastPushToAll<K extends keyof TContract["pushes"] & string>(
		name: K,
		body: InferSockaPushPayload<TContract, K>,
	): Promise<void> {
		return broadcastContractPushToAll(
			this.sessions,
			this.contract,
			name,
			body,
		);
	}
}

/**
 * Durable Object base class for socka WebSocket rooms.
 *
 * Subclasses declare {@link contract} and {@link buildSockaSessionConfig}; the
 * base wires WebSocket upgrade and hibernation resume to
 * `new SockaDoSession(websocket, host)`.
 *
 * @example
 * ```ts
 * class ChatRoomDO extends SockaWebSocketDO<typeof chatContract, SessionData, Env> {
 *   protected readonly contract = chatContract;
 *   protected buildSockaSessionConfig(ctx) { … }
 * }
 * ```
 */
export abstract class SockaWebSocketDO<
	TContract extends SockaContractBound,
	TData,
	TEnv extends object,
> extends SockaWebSocketDOBase<
	TContract,
	TData,
	SockaDoSession<TContract, TData, TEnv>,
	TEnv
> {}
