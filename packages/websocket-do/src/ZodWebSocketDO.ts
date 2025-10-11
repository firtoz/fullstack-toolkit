import { BaseWebSocketDO } from "./BaseWebSocketDO";
import type { ZodSession, ZodSessionOptions } from "./ZodSession";

export abstract class ZodWebSocketDO<
	TEnv extends object,
	TSession extends ZodSession<TEnv, any, any, any>,
	TClientMessage = any,
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
