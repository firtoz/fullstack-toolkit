import type { Context } from "hono";
import type {
	SessionClientMessage,
	SessionEnv,
	SessionServerMessage,
} from "./BaseSession";
import { BaseWebSocketDO } from "./BaseWebSocketDO";
import type { ZodSession, ZodSessionOptions } from "./ZodSession";

export type ZodSessionOptionsOrFactory<
	TClientMessage,
	TServerMessage,
	TEnv extends Cloudflare.Env = Cloudflare.Env,
> =
	| ZodSessionOptions<TClientMessage, TServerMessage>
	| ((
			ctx: Context<{ Bindings: TEnv }>,
			websocket: WebSocket,
	  ) => ZodSessionOptions<TClientMessage, TServerMessage>);

export abstract class ZodWebSocketDO<
	// biome-ignore lint/suspicious/noExplicitAny: We are using any on purpose to allow any type of session.
	TSession extends ZodSession<any, any, any, any>,
	TClientMessage extends
		SessionClientMessage<TSession> = SessionClientMessage<TSession>,
	TServerMessage extends
		SessionServerMessage<TSession> = SessionServerMessage<TSession>,
	TEnv extends SessionEnv<TSession> = SessionEnv<TSession>,
> extends BaseWebSocketDO<TSession> {
	constructor(
		ctx: DurableObjectState,
		env: TEnv,
		protected zodSessionOptions?: ZodSessionOptionsOrFactory<
			TClientMessage,
			TServerMessage,
			TEnv
		>,
	) {
		super(ctx, env);
	}

	protected abstract createZodSession(
		ctx: Context<{ Bindings: TEnv }>,
		websocket: WebSocket,
		options: ZodSessionOptions<TClientMessage, TServerMessage>,
	): TSession | Promise<TSession>;

	protected createSession(
		ctx: Context<{ Bindings: TEnv }>,
		websocket: WebSocket,
	): TSession | Promise<TSession> {
		const options =
			typeof this.zodSessionOptions === "function"
				? this.zodSessionOptions(ctx, websocket)
				: this.zodSessionOptions;

		if (!options) {
			throw new Error(
				"zodSessionOptions must be provided either in constructor or via getZodOptions override",
			);
		}

		return this.createZodSession(ctx, websocket, options);
	}
}
