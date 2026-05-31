import { DurableObject } from "cloudflare:workers";
import type { DOWithHonoApp } from "@firtoz/hono-fetcher/honoDoFetcher";
import { type Context, Hono } from "hono";
import type {
	BaseSession,
	SessionClientMessage,
	SessionEnv,
} from "./BaseSession";

export type BaseWebSocketDOOptions<
	// biome-ignore lint/suspicious/noExplicitAny: We are using any on purpose to allow any type of session.
	TSession extends BaseSession<any, any, any, any>,
	TEnv extends SessionEnv<TSession>,
> = {
	createSession: (
		ctx: Context<{ Bindings: TEnv }> | undefined,
		websocket: WebSocket,
	) => TSession | Promise<TSession>;
	/**
	 * If set, called on the WebSocketPair **server** socket before
	 * {@link DurableObjectState#acceptWebSocket}. Use `{ allowHalfOpen: true }` when you need
	 * to coordinate close independently (e.g. proxying). Omit for the usual hibernation-only path
	 * (no `WebSocket#accept` before `acceptWebSocket`), which matches
	 * [Durable Object WebSocket examples](https://developers.cloudflare.com/durable-objects/best-practices/websockets/).
	 */
	pairServerWebSocketAcceptOptions?: WebSocketAcceptOptions;
};

export abstract class BaseWebSocketDO<
		// biome-ignore lint/suspicious/noExplicitAny: We are using any on purpose to allow any type of session.
		TSession extends BaseSession<any, any, any, any> = BaseSession<
			// biome-ignore lint/suspicious/noExplicitAny: We are using any on purpose to allow any type of session.
			any,
			// biome-ignore lint/suspicious/noExplicitAny: We are using any on purpose to allow any type of session.
			any,
			// biome-ignore lint/suspicious/noExplicitAny: We are using any on purpose to allow any type of session.
			any,
			// biome-ignore lint/suspicious/noExplicitAny: We are using any on purpose to allow any type of session.
			any
		>,
		TEnv extends SessionEnv<TSession> = SessionEnv<TSession>,
	>
	extends DurableObject<TEnv>
	implements DOWithHonoApp
{
	protected readonly sessions = new Map<WebSocket, TSession>();
	abstract readonly app: Hono<{ Bindings: TEnv }>;

	constructor(
		ctx: DurableObjectState,
		env: TEnv,
		private readonly options: BaseWebSocketDOOptions<TSession, TEnv>,
	) {
		super(ctx, env);

		this.ctx.blockConcurrencyWhile(async () => {
			const websockets = this.ctx.getWebSockets();
			await Promise.all(
				websockets.map(async (websocket) => {
					try {
						// For resumed sessions, we don't have a Hono context
						// Pass undefined and let implementers handle it
						const session = await options.createSession(undefined, websocket);
						session.resume();
						this.sessions.set(websocket, session);
					} catch (error) {
						console.error(`Error during session setup: ${error}`);
						await this.webSocketError(websocket, error);
					}
				}),
			);
		});
	}

	protected getBaseApp() {
		return new Hono<{ Bindings: TEnv }>().get(
			"/websocket",
			async (ctx): Promise<Response> => {
				const { req } = ctx;
				if (req.header("Upgrade") !== "websocket") {
					console.error("Expected websocket");
					return ctx.text("Expected websocket", 400);
				}

				const gate = await this.beforeWebSocket(ctx);
				if (gate instanceof Response) {
					return gate;
				}

				const [client, server] = Object.values(new WebSocketPair()) as [
					WebSocket,
					WebSocket,
				];

				try {
					await this.handleSession(ctx, server);
					return new Response(null, { status: 101, webSocket: client });
				} catch (error) {
					console.error(error);
					client.accept();
					client.send(
						JSON.stringify({
							error: "Uncaught exception during session setup.",
						}),
					);
					client.close(1011, "Uncaught exception during session setup.");
					return new Response(null, { status: 101, webSocket: client });
				}
			},
		);
	}

	/**
	 * Optional gate before the WebSocket upgrade creates a {@link WebSocketPair}.
	 * Return an HTTP {@link Response} (e.g. `401` / `403`) to reject the upgrade;
	 * return `undefined` / `void` to proceed. Override on your DO subclass or use
	 * Hono middleware on a chained `app` for route-level checks.
	 */
	protected beforeWebSocket(
		_ctx: Context<{ Bindings: TEnv }>,
	): Response | undefined | Promise<Response | undefined> {
		return;
	}

	async handleSession(
		ctx: Context<{ Bindings: TEnv }>,
		ws: WebSocket,
	): Promise<void> {
		const acceptOpts = this.options.pairServerWebSocketAcceptOptions;
		if (acceptOpts !== undefined) {
			ws.accept(acceptOpts);
		}
		this.ctx.acceptWebSocket(ws);
		try {
			const session = await this.options.createSession(ctx, ws);
			session.startFresh(ctx);
			this.sessions.set(ws, session);
		} catch (error) {
			console.error(`Error during session setup: ${error}`);
			await this.webSocketError(ws, error);
		}
	}

	override async webSocketMessage(
		ws: WebSocket,
		message: string | ArrayBuffer,
	): Promise<void> {
		const session = this.sessions.get(ws);
		if (!session) return;

		try {
			if (message instanceof ArrayBuffer) {
				await session.handleBufferMessage(message);
				return;
			}

			const rawMessageSession = session as BaseSession<
				unknown,
				unknown,
				unknown,
				TEnv
			> & {
				handleRawMessage?: (rawMessage: string) => Promise<void>;
			};
			if (rawMessageSession.handleRawMessage) {
				await rawMessageSession.handleRawMessage(message);
				return;
			}

			const parsed = JSON.parse(message) as SessionClientMessage<TSession>;
			await session.handleMessage(parsed);
		} catch (error) {
			console.error(`Error during session message: ${error}`);
			// Let the implementer decide how to handle errors in their session implementation
			// The session can optionally implement error handling that closes the connection if needed
		}
	}

	override async webSocketClose(
		ws: WebSocket,
		code: number,
		reason: string,
		_wasClean: boolean,
	) {
		const session = this.sessions.get(ws);
		if (!session) return;

		try {
			await this.#handleClose(session);
		} catch (error) {
			console.error(`Error during session close: ${error}`);
		} finally {
			// Pre–2026-04-07 (manual close reply): required to complete the Close handshake and avoid
			// abnormal client closure. With web_socket_auto_reply_to_close (default on 2026-04-07+),
			// the runtime already replied; `close()` is a no-op if already CLOSED.
			ws.close(code, reason);
		}
	}

	override async webSocketError(ws: WebSocket, error: unknown) {
		const session = this.sessions.get(ws);
		if (!session) {
			// Idempotent: safe when the socket is already closed (auto close reply) or in CLOSING
			// (legacy manual reply to complete the handshake).
			ws.close(1011, "Error during session setup.");
			return;
		}

		console.error(`Error for session: ${error}`);
		try {
			await this.#handleClose(session);
		} catch (error) {
			console.error(`Error during session close: ${error}`);
		} finally {
			ws.close(1011, "Error during session.");
		}
	}

	async #handleClose(session: TSession) {
		try {
			await session.handleClose();
		} catch (error) {
			console.error(`Error during session close: ${error}`);
		} finally {
			this.sessions.delete(session.websocket);
		}
	}

	override fetch(request: Request): Response | Promise<Response> {
		return this.app.fetch(request, this.env);
	}
}
