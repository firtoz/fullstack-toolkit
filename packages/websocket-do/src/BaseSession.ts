import type { Context } from "hono";
import { WebsocketWrapper } from "./WebsocketWrapper";

// biome-ignore lint/suspicious/noExplicitAny: We are using any on purpose to allow any type of session.
export type SessionData<TSession extends BaseSession<any, any, any, any>> =
	TSession extends BaseSession<
		infer TData,
		infer _TServerMessage,
		infer _TClientMessage,
		infer _TEnv
	>
		? TData
		: never;

export type SessionClientMessage<
	// biome-ignore lint/suspicious/noExplicitAny: We are using any on purpose to allow any type of session.
	TSession extends BaseSession<any, any, any, any>,
> = TSession extends BaseSession<
	infer _TData,
	infer _TServerMessage,
	infer TClientMessage,
	infer _TEnv
>
	? TClientMessage
	: never;

export type SessionServerMessage<
	// biome-ignore lint/suspicious/noExplicitAny: We are using any on purpose to allow any type of session.
	TSession extends BaseSession<any, any, any, any>,
> = TSession extends BaseSession<
	infer _TData,
	infer TServerMessage,
	infer _TClientMessage,
	infer _TEnv
>
	? TServerMessage
	: never;

export type SessionEnv<
	// biome-ignore lint/suspicious/noExplicitAny: We are using any on purpose to allow any type of session.
	TSession extends BaseSession<any, any, any, any>,
> = TSession extends BaseSession<
	infer _TData,
	infer _TServerMessage,
	infer _TClientMessage,
	infer TEnv extends Cloudflare.Env
>
	? TEnv
	: never;

export type BaseSessionHandlers<
	TData,
	_TServerMessage,
	TClientMessage,
	TEnv extends object = Cloudflare.Env,
> = {
	createData: (ctx: Context<{ Bindings: TEnv }>) => TData;
	handleMessage: (message: TClientMessage) => Promise<void>;
	handleBufferMessage: (message: ArrayBuffer) => Promise<void>;
	handleClose: () => Promise<void>;
};

export class BaseSession<
	TData,
	TServerMessage,
	TClientMessage,
	TEnv extends object = Cloudflare.Env,
> {
	private _data!: TData;

	public get data(): TData {
		return this._data;
	}

	private set data(data: TData) {
		this._data = data;
	}

	private readonly wrapper: WebsocketWrapper<TData, TServerMessage>;
	protected readonly handlers: BaseSessionHandlers<
		TData,
		TServerMessage,
		TClientMessage,
		TEnv
	>;

	constructor(
		public websocket: WebSocket,
		protected sessions: Map<
			WebSocket,
			BaseSession<TData, TServerMessage, TClientMessage, TEnv>
		>,
		handlers: BaseSessionHandlers<TData, TServerMessage, TClientMessage, TEnv>,
	) {
		this.wrapper = new WebsocketWrapper<TData, TServerMessage>(websocket);
		this.handlers = handlers;
	}

	public startFresh(ctx: Context<{ Bindings: TEnv }>) {
		this.data = this.handlers.createData(ctx);
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

	public broadcast(message: TServerMessage, excludeSelf = false) {
		for (const session of this.sessions.values()) {
			if (excludeSelf && session === this) continue;
			session.send(message);
		}
	}

	public send(message: TServerMessage) {
		this.wrapper.send(message);
	}

	async handleMessage(message: TClientMessage): Promise<void> {
		return this.handlers.handleMessage(message);
	}

	async handleBufferMessage(message: ArrayBuffer): Promise<void> {
		return this.handlers.handleBufferMessage(message);
	}

	async handleClose(): Promise<void> {
		return this.handlers.handleClose();
	}
}
