import type { Context } from "hono";
import { WebsocketWrapper } from "./WebsocketWrapper";

export type SessionClientMessage<TSession extends BaseSession> =
	TSession extends BaseSession<never, never, infer TClientMessage, never>
		? TClientMessage
		: never;

export abstract class BaseSession<
	// biome-ignore lint/suspicious/noExplicitAny: Generic type parameter with flexible default
	TEnv extends object = any,
	// biome-ignore lint/suspicious/noExplicitAny: Generic type parameter with flexible default
	TData = any,
	// biome-ignore lint/suspicious/noExplicitAny: Generic type parameter with flexible default
	TServerMessage = any,
	// biome-ignore lint/suspicious/noExplicitAny: Generic type parameter with flexible default
	TClientMessage = any,
> {
	private _data!: TData;

	public get data(): TData {
		return this._data;
	}

	private set data(data: TData) {
		this._data = data;
	}

	private readonly wrapper: WebsocketWrapper<TData, TServerMessage>;

	constructor(
		public websocket: WebSocket,
		protected sessions: Map<
			WebSocket,
			BaseSession<TEnv, TData, TServerMessage, TClientMessage>
		>,
	) {
		this.wrapper = new WebsocketWrapper<TData, TServerMessage>(websocket);
	}

	public startFresh(ctx: Context<{ Bindings: TEnv }>) {
		this.data = this.createData(ctx);
		this.wrapper.serializeAttachment(this.data);
	}

	public resume() {
		const existingData = this.wrapper.deserializeAttachment();
		if (existingData) {
			this.data = existingData;
		} else {
			throw new Error("No data to resume");
		}
	}

	public update() {
		this.wrapper.serializeAttachment(this.data);
	}

	protected abstract createData(ctx: Context<{ Bindings: TEnv }>): TData;

	protected broadcast(message: TServerMessage, excludeSelf = false) {
		for (const session of this.sessions.values()) {
			if (excludeSelf && session === this) continue;
			session.send(message);
		}
	}

	protected send(message: TServerMessage) {
		this.wrapper.send(message);
	}

	abstract handleMessage(message: TClientMessage): Promise<void>;
	abstract handleBufferMessage(message: ArrayBuffer): Promise<void>;
	abstract handleClose(): Promise<void>;
}
