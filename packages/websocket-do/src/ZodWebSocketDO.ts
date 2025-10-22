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
			ctx: Context<{ Bindings: TEnv }> | undefined,
			websocket: WebSocket,
	  ) => ZodSessionOptions<TClientMessage, TServerMessage>);

export type ZodWebSocketDOOptions<
	// biome-ignore lint/suspicious/noExplicitAny: We are using any on purpose to allow any type of session.
	TSession extends ZodSession<any, any, any, any>,
	TClientMessage,
	TServerMessage,
	TEnv extends SessionEnv<TSession>,
> = {
	zodSessionOptions: ZodSessionOptionsOrFactory<
		TClientMessage,
		TServerMessage,
		TEnv
	>;
	createZodSession: (
		ctx: Context<{ Bindings: TEnv }> | undefined,
		websocket: WebSocket,
		options: ZodSessionOptions<TClientMessage, TServerMessage>,
	) => TSession | Promise<TSession>;
};

export abstract class ZodWebSocketDO<
	// biome-ignore lint/suspicious/noExplicitAny: We are using any on purpose to allow any type of session.
	TSession extends ZodSession<any, any, any, any>,
	TClientMessage extends
		SessionClientMessage<TSession> = SessionClientMessage<TSession>,
	TServerMessage extends
		SessionServerMessage<TSession> = SessionServerMessage<TSession>,
	TEnv extends SessionEnv<TSession> = SessionEnv<TSession>,
> extends BaseWebSocketDO<TSession, TEnv> {
	protected readonly zodSessionOptions: ZodSessionOptionsOrFactory<
		TClientMessage,
		TServerMessage,
		TEnv
	>;
	protected readonly createZodSessionFn: (
		ctx: Context<{ Bindings: TEnv }> | undefined,
		websocket: WebSocket,
		options: ZodSessionOptions<TClientMessage, TServerMessage>,
	) => TSession | Promise<TSession>;

	constructor(
		ctx: DurableObjectState,
		env: TEnv,
		options: ZodWebSocketDOOptions<
			TSession,
			TClientMessage,
			TServerMessage,
			TEnv
		>,
	) {
		super(ctx, env, {
			createSession: (ctx, websocket) => {
				const zodOptions =
					typeof options.zodSessionOptions === "function"
						? options.zodSessionOptions(ctx, websocket)
						: options.zodSessionOptions;

				return options.createZodSession(ctx, websocket, zodOptions);
			},
		});
		this.zodSessionOptions = options.zodSessionOptions;
		this.createZodSessionFn = options.createZodSession;
	}
}
