import type { Context } from "hono";
import type {
	SessionClientMessage,
	SessionEnv,
	SessionServerMessage,
} from "./BaseSession";
import { BaseWebSocketDO } from "./BaseWebSocketDO";
import type {
	StandardSchemaSession,
	StandardSchemaSessionOptions,
} from "./StandardSchemaSession";

export type StandardSchemaSessionOptionsOrFactory<
	TClientMessage,
	TServerMessage,
	TEnv extends Cloudflare.Env = Cloudflare.Env,
> =
	| StandardSchemaSessionOptions<TClientMessage, TServerMessage>
	| ((
			ctx: Context<{ Bindings: TEnv }> | undefined,
			websocket: WebSocket,
	  ) => StandardSchemaSessionOptions<TClientMessage, TServerMessage>);

export type StandardSchemaWebSocketDOOptions<
	// biome-ignore lint/suspicious/noExplicitAny: We are using any on purpose to allow any type of session.
	TSession extends StandardSchemaSession<any, any, any, any>,
	TClientMessage,
	TServerMessage,
	TEnv extends SessionEnv<TSession>,
> = {
	standardSchemaSessionOptions: StandardSchemaSessionOptionsOrFactory<
		TClientMessage,
		TServerMessage,
		TEnv
	>;
	createStandardSchemaSession: (
		ctx: Context<{ Bindings: TEnv }> | undefined,
		websocket: WebSocket,
		options: StandardSchemaSessionOptions<TClientMessage, TServerMessage>,
	) => TSession | Promise<TSession>;
};

export abstract class StandardSchemaWebSocketDO<
	// biome-ignore lint/suspicious/noExplicitAny: We are using any on purpose to allow any type of session.
	TSession extends StandardSchemaSession<any, any, any, any>,
	TClientMessage extends
		SessionClientMessage<TSession> = SessionClientMessage<TSession>,
	TServerMessage extends
		SessionServerMessage<TSession> = SessionServerMessage<TSession>,
	TEnv extends SessionEnv<TSession> = SessionEnv<TSession>,
> extends BaseWebSocketDO<TSession, TEnv> {
	protected readonly standardSchemaSessionOptions: StandardSchemaSessionOptionsOrFactory<
		TClientMessage,
		TServerMessage,
		TEnv
	>;
	protected readonly createStandardSchemaSessionFn: (
		ctx: Context<{ Bindings: TEnv }> | undefined,
		websocket: WebSocket,
		options: StandardSchemaSessionOptions<TClientMessage, TServerMessage>,
	) => TSession | Promise<TSession>;

	constructor(
		ctx: DurableObjectState,
		env: TEnv,
		options: StandardSchemaWebSocketDOOptions<
			TSession,
			TClientMessage,
			TServerMessage,
			TEnv
		>,
	) {
		super(ctx, env, {
			createSession: (ctx, websocket) => {
				const schemaOptions =
					typeof options.standardSchemaSessionOptions === "function"
						? options.standardSchemaSessionOptions(ctx, websocket)
						: options.standardSchemaSessionOptions;

				return options.createStandardSchemaSession(
					ctx,
					websocket,
					schemaOptions,
				);
			},
		});
		this.standardSchemaSessionOptions = options.standardSchemaSessionOptions;
		this.createStandardSchemaSessionFn = options.createStandardSchemaSession;
	}
}
