import { BaseWebSocketDO } from "./BaseWebSocketDO";
import type { ZodSession, ZodSessionOptions } from "./ZodSession";

export abstract class ZodWebSocketDO<
	TEnv extends object,
	// biome-ignore lint/suspicious/noExplicitAny: We need to allow any for the session
	TSession extends ZodSession<TEnv, any, any, any>,
	// biome-ignore lint/suspicious/noExplicitAny: We need to allow any for the client message
	TClientMessage = any,
	// biome-ignore lint/suspicious/noExplicitAny: We need to allow any for the server message
	TServerMessage = any,
> extends BaseWebSocketDO<TEnv, TSession> {
	protected abstract getZodOptions(): ZodSessionOptions<
		TClientMessage,
		TServerMessage
	>;

	protected abstract createZodSession(
		websocket: WebSocket,
		options: ZodSessionOptions<TClientMessage, TServerMessage>,
	): TSession | Promise<TSession>;

	protected createSession(websocket: WebSocket): TSession | Promise<TSession> {
		const options = this.getZodOptions();
		return this.createZodSession(websocket, options);
	}
}
