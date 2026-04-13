import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SockaError } from "socka/core";
import type { SockaWireFormat } from "socka/core";
import { SockaRpc } from "socka/client";
import { SockaWebSocketSession } from "socka/server";
import { roundtripContract } from "./fixtures/roundtrip-contract";
import { roundtripHandlers } from "./fixtures/roundtrip-handlers";

/**
 * Bun {@link ServerWebSocket} does not implement `addEventListener`, so
 * `attachSockaWebSocket` cannot be used. Dispatch inbound frames the same way
 * as {@link attachSockaWebSocket} from `socka/server`.
 */
async function dispatchSockaSessionMessage(
	session: SockaWebSocketSession<typeof roundtripContract>,
	wireFormat: SockaWireFormat,
	data: unknown,
): Promise<void> {
	if (typeof data === "string") {
		await session.handleRawMessage(data);
		return;
	}
	if (data instanceof ArrayBuffer) {
		if (wireFormat === "json") {
			await session.handleRawMessage(new TextDecoder().decode(data));
		} else {
			await session.handleBinaryMessage(data);
		}
		return;
	}
	if (data instanceof Blob) {
		if (wireFormat === "json") {
			await session.handleRawMessage(await data.text());
		} else {
			await session.handleBinaryMessage(await data.arrayBuffer());
		}
		return;
	}
	if (data instanceof Uint8Array) {
		if (wireFormat === "json") {
			await session.handleRawMessage(new TextDecoder().decode(data));
			return;
		}
		const copy = new Uint8Array(data.length);
		copy.set(data);
		await session.handleBinaryMessage(copy.buffer);
		return;
	}
	if (typeof Buffer !== "undefined" && Buffer.isBuffer(data)) {
		if (wireFormat === "json") {
			await session.handleRawMessage(data.toString("utf8"));
			return;
		}
		await session.handleBinaryMessage(new Uint8Array(data).buffer);
	}
}

function startBunSockaServer(wireFormat: SockaWireFormat): {
	server: ReturnType<typeof Bun.serve>;
	port: number;
} {
	const sessions = new Map<
		globalThis.WebSocket,
		SockaWebSocketSession<typeof roundtripContract>
	>();
	const handleClose = async (): Promise<void> => {};

	const server = Bun.serve({
		port: 0,
		fetch(req, srv) {
			if (srv.upgrade(req)) {
				return;
			}
			return new Response("not found", { status: 404 });
		},
		websocket: {
			open(ws) {
				const domWs = ws as unknown as WebSocket;
				const session = new SockaWebSocketSession(domWs, sessions, {
					contract: roundtripContract,
					wireFormat,
					handlers: roundtripHandlers,
					handleClose,
				});
				sessions.set(domWs, session);
			},
			async message(ws, message) {
				const domWs = ws as unknown as WebSocket;
				const session = sessions.get(domWs);
				if (!session) return;
				await dispatchSockaSessionMessage(session, wireFormat, message);
			},
			async close(ws) {
				const domWs = ws as unknown as WebSocket;
				sessions.delete(domWs);
				await handleClose();
			},
		},
	});

	const port = server.port;
	if (port === undefined) {
		throw new Error("Bun.serve: expected port");
	}
	return { server, port };
}

describe("socka/server e2e (Bun.serve)", () => {
	let json: ReturnType<typeof startBunSockaServer>;
	let msgpack: ReturnType<typeof startBunSockaServer>;

	beforeAll(() => {
		json = startBunSockaServer("json");
		msgpack = startBunSockaServer("msgpack");
	});

	afterAll(() => {
		json.server.stop();
		msgpack.server.stop();
	});

	test("JSON: echo and ping", async () => {
		const rpc = new SockaRpc({
			contract: roundtripContract,
			url: `ws://127.0.0.1:${json.port}`,
			wireFormat: "json",
		});
		await rpc.client.waitForOpen();

		await expect(rpc.rpc.echo({ text: "hello" })).resolves.toEqual({
			text: "hello",
		});
		await expect(rpc.rpc.ping()).resolves.toEqual({ pong: true });

		rpc.client.close();
	});

	test("JSON: handler SockaError surfaces on client", async () => {
		const rpc = new SockaRpc({
			contract: roundtripContract,
			url: `ws://127.0.0.1:${json.port}`,
			wireFormat: "json",
		});
		await rpc.client.waitForOpen();

		const err = await rpc.rpc.fail().catch((e: unknown) => e);
		expect(err).toBeInstanceOf(SockaError);
		expect((err as SockaError).message).toBe("intentional failure");

		rpc.client.close();
	});

	test("msgpack: echo and ping", async () => {
		const rpc = new SockaRpc({
			contract: roundtripContract,
			url: `ws://127.0.0.1:${msgpack.port}`,
			wireFormat: "msgpack",
		});
		await rpc.client.waitForOpen();

		await expect(rpc.rpc.echo({ text: "bin" })).resolves.toEqual({
			text: "bin",
		});
		await expect(rpc.rpc.ping()).resolves.toEqual({ pong: true });

		rpc.client.close();
	});
});
