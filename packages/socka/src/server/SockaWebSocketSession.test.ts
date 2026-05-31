import { describe, expect, mock, test } from "bun:test";
import * as z from "zod";
import { defineSocka } from "../core/contract";
import { SockaError } from "../core/socka-error";
import { decodeSockaWire, encodeClientRequest } from "../core/envelope";
import { encodeSockaWire, parseWirePayload } from "../core/wire-codec";
import { rpcTestContract } from "../test-utils/rpc-contract-for-tests";
import { createFakeWebSocket } from "../test-utils/fake-websocket";
import { attachSockaWebSocket } from "./attachSockaWebSocket";
import { dispatchSockaInboundMessage } from "./dispatchSockaInboundMessage";
import {
	SockaWebSocketSession,
	broadcastContractPushToAll,
	broadcastSockaEventToAll,
} from "./SockaWebSocketSession";

describe("SockaWebSocketSession", () => {
	test("echo RPC responds with serverResponse", async () => {
		const { socket, dispatchOpen, sent } = createFakeWebSocket();
		dispatchOpen();
		const sessions = new Map<
			WebSocket,
			SockaWebSocketSession<typeof rpcTestContract, Record<string, never>>
		>();
		const session = new SockaWebSocketSession(socket, sessions, {
			strictUpgradeRequest: false,
			contract: rpcTestContract,
			handlers: {
				echo: async (input) => ({ text: input.text }),
				ping: async () => ({ pong: true as const }),
			},
			handleClose: async () => {},
		});
		sessions.set(socket, session);

		const req = encodeClientRequest("r1", "echo", { text: "hi" });
		const wire = encodeSockaWire(req, "json") as string;
		await session.handleRawMessage(wire);

		expect(sent.length).toBe(1);
		const out = JSON.parse(sent[0] as string);
		expect(out.socka).toBe("serverResponse");
		expect(out.body).toEqual({ text: "hi" });
	});

	test("echo RPC msgpack responds with serverResponse", async () => {
		const { socket, dispatchOpen, sent } = createFakeWebSocket();
		dispatchOpen();
		const sessions = new Map<
			WebSocket,
			SockaWebSocketSession<typeof rpcTestContract, Record<string, never>>
		>();
		const session = new SockaWebSocketSession(socket, sessions, {
			strictUpgradeRequest: false,
			contract: rpcTestContract,
			wireFormat: "msgpack",
			handlers: {
				echo: async (input) => ({ text: input.text }),
				ping: async () => ({ pong: true as const }),
			},
			handleClose: async () => {},
		});
		sessions.set(socket, session);

		const req = encodeClientRequest("r1", "echo", { text: "hi" });
		const wire = encodeSockaWire(req, "msgpack") as Uint8Array;
		await session.handleBinaryMessage(new Uint8Array(wire).buffer);

		expect(sent.length).toBe(1);
		const first = sent[0];
		if (!(first instanceof ArrayBuffer) && !(first instanceof Uint8Array)) {
			throw new Error("expected binary frame");
		}
		const buf = first instanceof Uint8Array ? first : new Uint8Array(first);
		const parsed = parseWirePayload(buf, "msgpack");
		const decoded = decodeSockaWire(parsed);
		expect(decoded.kind).toBe("serverResponse");
		if (decoded.kind === "serverResponse") {
			expect(decoded.frame.body).toEqual({ text: "hi" });
		}
	});

	test("fire-and-forget RPC sends no serverResponse on success", async () => {
		const ffContract = defineSocka({
			calls: {
				nudge: {
					input: z.object({ x: z.number() }),
				},
			},
		});
		const { socket, dispatchOpen, sent } = createFakeWebSocket();
		dispatchOpen();
		const sessions = new Map<
			WebSocket,
			SockaWebSocketSession<typeof ffContract, Record<string, never>>
		>();
		const session = new SockaWebSocketSession(socket, sessions, {
			strictUpgradeRequest: false,
			contract: ffContract,
			handlers: {
				nudge: async () => {},
			},
			handleClose: async () => {},
		});
		sessions.set(socket, session);

		const req = encodeClientRequest("r1", "nudge", { x: 1 });
		const wire = encodeSockaWire(req, "json") as string;
		await session.handleRawMessage(wire);

		expect(sent.length).toBe(0);
	});

	test("fire-and-forget handler failure sends serverError with rpc", async () => {
		const ffContract = defineSocka({
			calls: {
				nudge: {
					input: z.object({ x: z.number() }),
				},
			},
		});
		const { socket, dispatchOpen, sent } = createFakeWebSocket();
		dispatchOpen();
		const sessions = new Map<
			WebSocket,
			SockaWebSocketSession<typeof ffContract, Record<string, never>>
		>();
		const session = new SockaWebSocketSession(socket, sessions, {
			strictUpgradeRequest: false,
			contract: ffContract,
			handlers: {
				nudge: async () => {
					throw new SockaError("bad");
				},
			},
			handleClose: async () => {},
		});
		sessions.set(socket, session);

		const req = encodeClientRequest("r1", "nudge", { x: 1 });
		const wire = encodeSockaWire(req, "json") as string;
		await session.handleRawMessage(wire);

		expect(sent.length).toBe(1);
		const out = JSON.parse(sent[0] as string);
		expect(out.socka).toBe("serverError");
		expect(out.rpc).toBe("nudge");
		expect(out.error).toBe("bad");
	});

	test("broadcastPush reaches peer session", async () => {
		const a = createFakeWebSocket();
		const b = createFakeWebSocket();
		a.dispatchOpen();
		b.dispatchOpen();
		const sessions = new Map<
			WebSocket,
			SockaWebSocketSession<typeof rpcTestContract, Record<string, never>>
		>();
		const sa = new SockaWebSocketSession(a.socket, sessions, {
			strictUpgradeRequest: false,
			contract: rpcTestContract,
			handlers: {
				echo: async (input) => ({ text: input.text }),
				ping: async () => ({ pong: true as const }),
			},
			handleClose: async () => {},
		});
		const sb = new SockaWebSocketSession(b.socket, sessions, {
			strictUpgradeRequest: false,
			contract: rpcTestContract,
			handlers: {
				echo: async (input) => ({ text: input.text }),
				ping: async () => ({ pong: true as const }),
			},
			handleClose: async () => {},
		});
		sessions.set(a.socket, sa);
		sessions.set(b.socket, sb);

		await sa.broadcastPush("notify", { msg: "x" });
		expect(a.sent.length).toBe(1);
		expect(b.sent.length).toBe(1);
		const ev = JSON.parse(b.sent[0] as string);
		expect(ev.socka).toBe("serverEvent");
		expect(ev.event).toBe("notify");

		expect(sa.listPeers().length).toBe(2);
		expect(sa.listPeers({ excludeSelf: true }).length).toBe(1);
		expect(sa.listPeersWith((s) => s).length).toBe(2);
		expect(sa.listPeersWith((s) => s, { excludeSelf: true }).length).toBe(1);
	});

	test("broadcastContractPushToAll reaches every session without a caller", async () => {
		const a = createFakeWebSocket();
		const b = createFakeWebSocket();
		a.dispatchOpen();
		b.dispatchOpen();
		const sessions = new Map<
			WebSocket,
			SockaWebSocketSession<typeof rpcTestContract, Record<string, never>>
		>();
		const sa = new SockaWebSocketSession(a.socket, sessions, {
			strictUpgradeRequest: false,
			contract: rpcTestContract,
			handlers: {
				echo: async (input) => ({ text: input.text }),
				ping: async () => ({ pong: true as const }),
			},
			handleClose: async () => {},
		});
		const sb = new SockaWebSocketSession(b.socket, sessions, {
			strictUpgradeRequest: false,
			contract: rpcTestContract,
			handlers: {
				echo: async (input) => ({ text: input.text }),
				ping: async () => ({ pong: true as const }),
			},
			handleClose: async () => {},
		});
		sessions.set(a.socket, sa);
		sessions.set(b.socket, sb);

		await broadcastContractPushToAll(sessions, rpcTestContract, "notify", {
			msg: "room-wide",
		});
		expect(a.sent.length).toBe(1);
		expect(b.sent.length).toBe(1);
	});

	test("broadcastContractPushToAll is a no-op for empty sessions map", async () => {
		const sessions = new Map<
			WebSocket,
			SockaWebSocketSession<typeof rpcTestContract, Record<string, never>>
		>();
		await broadcastContractPushToAll(sessions, rpcTestContract, "notify", {
			msg: "x",
		});
	});

	test("broadcastSockaEventToAll emits pre-validated payload to every session", () => {
		const a = createFakeWebSocket();
		const b = createFakeWebSocket();
		a.dispatchOpen();
		b.dispatchOpen();
		const sessions = new Map<
			WebSocket,
			SockaWebSocketSession<typeof rpcTestContract, Record<string, never>>
		>();
		const sa = new SockaWebSocketSession(a.socket, sessions, {
			strictUpgradeRequest: false,
			contract: rpcTestContract,
			handlers: {
				echo: async (input) => ({ text: input.text }),
				ping: async () => ({ pong: true as const }),
			},
			handleClose: async () => {},
		});
		const sb = new SockaWebSocketSession(b.socket, sessions, {
			strictUpgradeRequest: false,
			contract: rpcTestContract,
			handlers: {
				echo: async (input) => ({ text: input.text }),
				ping: async () => ({ pong: true as const }),
			},
			handleClose: async () => {},
		});
		sessions.set(a.socket, sa);
		sessions.set(b.socket, sb);

		broadcastSockaEventToAll(sessions, "notify", { msg: "raw" });
		expect(a.sent.length).toBe(1);
		expect(b.sent.length).toBe(1);
	});

	test("default strict upgrade throws without init.request", () => {
		const { socket, dispatchOpen } = createFakeWebSocket();
		dispatchOpen();
		const sessions = new Map<
			WebSocket,
			SockaWebSocketSession<typeof rpcTestContract, Record<string, never>>
		>();
		expect(() => {
			new SockaWebSocketSession(socket, sessions, {
				contract: rpcTestContract,
				handlers: {
					echo: async (input) => ({ text: input.text }),
					ping: async () => ({ pong: true as const }),
				},
				handleClose: async () => {},
			});
		}).toThrow(/strict upgrade/);
	});
});

describe("attachSockaWebSocket", () => {
	test("routes messages and runs handleClose on close", async () => {
		const { socket, dispatchMessage, dispatchOpen, dispatchClose, sent } =
			createFakeWebSocket();
		dispatchOpen();
		const sessions = new Map<
			WebSocket,
			SockaWebSocketSession<typeof rpcTestContract, Record<string, never>>
		>();
		const onClose = mock(() => Promise.resolve());
		const { session: attachedSession } = attachSockaWebSocket(
			socket,
			sessions,
			{
				strictUpgradeRequest: false,
				contract: rpcTestContract,
				handlers: {
					echo: async (input) => ({ text: input.text }),
					ping: async () => ({ pong: true as const }),
				},
				handleClose: onClose,
			},
		);

		const req = encodeClientRequest("r2", "ping", {});
		const wire = encodeSockaWire(req, "json") as string;
		dispatchMessage(wire);

		await new Promise((r) => setTimeout(r, 10));
		expect(sent.length).toBe(1);
		expect(JSON.parse(sent[0] as string).socka).toBe("serverResponse");

		dispatchClose();
		await new Promise((r) => setTimeout(r, 10));
		expect(onClose).toHaveBeenCalledTimes(1);
		expect(onClose).toHaveBeenCalledWith(attachedSession);
		expect(sessions.size).toBe(0);
	});

	test("onAttached runs after session is registered", async () => {
		const { socket, dispatchOpen } = createFakeWebSocket();
		dispatchOpen();
		const sessions = new Map<
			WebSocket,
			SockaWebSocketSession<typeof rpcTestContract, Record<string, never>>
		>();
		const onAttached = mock(
			(s: SockaWebSocketSession<typeof rpcTestContract>) => {
				expect(sessions.get(socket)).toBe(s);
			},
		);
		attachSockaWebSocket(socket, sessions, {
			strictUpgradeRequest: false,
			contract: rpcTestContract,
			handlers: {
				echo: async (input) => ({ text: input.text }),
				ping: async () => ({ pong: true as const }),
			},
			handleClose: async () => {},
			onAttached,
		});
		expect(onAttached).toHaveBeenCalledTimes(1);
	});
});

describe("dispatchSockaInboundMessage", () => {
	test("JSON string routes to serverResponse", async () => {
		const { socket, dispatchOpen, sent } = createFakeWebSocket();
		dispatchOpen();
		const sessions = new Map<
			WebSocket,
			SockaWebSocketSession<typeof rpcTestContract, Record<string, never>>
		>();
		const session = new SockaWebSocketSession(socket, sessions, {
			strictUpgradeRequest: false,
			contract: rpcTestContract,
			handlers: {
				echo: async (input) => ({ text: input.text }),
				ping: async () => ({ pong: true as const }),
			},
			handleClose: async () => {},
		});
		sessions.set(socket, session);

		const req = encodeClientRequest("r1", "echo", { text: "via-dispatch" });
		const wire = encodeSockaWire(req, "json") as string;
		await dispatchSockaInboundMessage(session, "json", wire);

		expect(sent.length).toBe(1);
		const out = JSON.parse(sent[0] as string);
		expect(out.socka).toBe("serverResponse");
		expect(out.body).toEqual({ text: "via-dispatch" });
	});

	test("JSON ArrayBuffer decodes UTF-8 like attachSockaWebSocket", async () => {
		const { socket, dispatchOpen, sent } = createFakeWebSocket();
		dispatchOpen();
		const sessions = new Map<
			WebSocket,
			SockaWebSocketSession<typeof rpcTestContract, Record<string, never>>
		>();
		const session = new SockaWebSocketSession(socket, sessions, {
			strictUpgradeRequest: false,
			contract: rpcTestContract,
			handlers: {
				echo: async (input) => ({ text: input.text }),
				ping: async () => ({ pong: true as const }),
			},
			handleClose: async () => {},
		});
		sessions.set(socket, session);

		const req = encodeClientRequest("r1", "ping", {});
		const wire = encodeSockaWire(req, "json") as string;
		const buf = new TextEncoder().encode(wire);
		await dispatchSockaInboundMessage(session, "json", buf.buffer);

		expect(sent.length).toBe(1);
		expect(JSON.parse(sent[0] as string).socka).toBe("serverResponse");
	});

	test("msgpack binary routes to serverResponse", async () => {
		const { socket, dispatchOpen, sent } = createFakeWebSocket();
		dispatchOpen();
		const sessions = new Map<
			WebSocket,
			SockaWebSocketSession<typeof rpcTestContract, Record<string, never>>
		>();
		const session = new SockaWebSocketSession(socket, sessions, {
			strictUpgradeRequest: false,
			contract: rpcTestContract,
			wireFormat: "msgpack",
			handlers: {
				echo: async (input) => ({ text: input.text }),
				ping: async () => ({ pong: true as const }),
			},
			handleClose: async () => {},
		});
		sessions.set(socket, session);

		const req = encodeClientRequest("r1", "echo", { text: "bin" });
		const wire = encodeSockaWire(req, "msgpack") as Uint8Array;
		const exact = new Uint8Array(wire.length);
		exact.set(wire);
		await dispatchSockaInboundMessage(session, "msgpack", exact.buffer);

		expect(sent.length).toBe(1);
		const first = sent[0];
		if (!(first instanceof ArrayBuffer) && !(first instanceof Uint8Array)) {
			throw new Error("expected binary frame");
		}
		const u8 = first instanceof Uint8Array ? first : new Uint8Array(first);
		const parsed = parseWirePayload(u8, "msgpack");
		const decoded = decodeSockaWire(parsed);
		expect(decoded.kind).toBe("serverResponse");
		if (decoded.kind === "serverResponse") {
			expect(decoded.frame.body).toEqual({ text: "bin" });
		}
	});
});
