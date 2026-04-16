import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { AddressInfo } from "node:net";
import { SockaError } from "@firtoz/socka/core";
import { SockaSession } from "@firtoz/socka/client";
import { attachSockaWebSocket } from "@firtoz/socka/server";
import type { SockaWebSocketSession } from "@firtoz/socka/server";
import type { WebSocket as NodeWebSocket } from "ws";
import { WebSocketServer } from "ws";
import { roundtripContract } from "./fixtures/roundtrip-contract";
import { roundtripHandlers } from "./fixtures/roundtrip-handlers";

async function listenWss(): Promise<{ wss: WebSocketServer; port: number }> {
	return new Promise((resolve, reject) => {
		const wss = new WebSocketServer({ port: 0 });
		wss.once("listening", () => {
			const addr = wss.address();
			if (typeof addr === "string" || addr === null) {
				reject(new Error("expected socket port"));
				return;
			}
			resolve({ wss, port: (addr as AddressInfo).port });
		});
		wss.once("error", reject);
	});
}

function closeWss(wss: WebSocketServer): Promise<void> {
	return new Promise((resolve, reject) => {
		wss.close((err: Error | undefined) => {
			if (err) reject(err);
			else resolve();
		});
	});
}

describe("@firtoz/socka/server e2e (ws)", () => {
	let wssJson: WebSocketServer;
	let wssMsgpack: WebSocketServer;
	let portJson: number;
	let portMsgpack: number;

	const sessionsJson = new Map<
		globalThis.WebSocket,
		SockaWebSocketSession<typeof roundtripContract>
	>();
	const sessionsMsgpack = new Map<
		globalThis.WebSocket,
		SockaWebSocketSession<typeof roundtripContract>
	>();

	beforeAll(async () => {
		const json = await listenWss();
		wssJson = json.wss;
		portJson = json.port;
		wssJson.on("connection", (ws: NodeWebSocket) => {
			attachSockaWebSocket(
				ws as unknown as globalThis.WebSocket,
				sessionsJson,
				{
					strictUpgradeRequest: false,
					contract: roundtripContract,
					wireFormat: "json",
					handlers: roundtripHandlers,
					handleClose: async () => {},
				},
			);
		});

		const mp = await listenWss();
		wssMsgpack = mp.wss;
		portMsgpack = mp.port;
		wssMsgpack.on("connection", (ws: NodeWebSocket) => {
			attachSockaWebSocket(
				ws as unknown as globalThis.WebSocket,
				sessionsMsgpack,
				{
					strictUpgradeRequest: false,
					contract: roundtripContract,
					wireFormat: "msgpack",
					handlers: roundtripHandlers,
					handleClose: async () => {},
				},
			);
		});
	});

	afterAll(async () => {
		await closeWss(wssJson);
		await closeWss(wssMsgpack);
	});

	test("JSON: echo and ping", async () => {
		const rpc = new SockaSession({
			contract: roundtripContract,
			url: `ws://127.0.0.1:${portJson}`,
			wireFormat: "json",
		});
		await rpc.client.waitForOpen();

		await expect(rpc.send.echo({ text: "hello" })).resolves.toEqual({
			text: "hello",
		});
		await expect(rpc.send.ping()).resolves.toEqual({ pong: true });

		rpc.client.close();
	});

	test("JSON: handler SockaError surfaces on client", async () => {
		const rpc = new SockaSession({
			contract: roundtripContract,
			url: `ws://127.0.0.1:${portJson}`,
			wireFormat: "json",
		});
		await rpc.client.waitForOpen();

		const err = await rpc.send.fail().catch((e: unknown) => e);
		expect(err).toBeInstanceOf(SockaError);
		expect((err as SockaError).message).toBe("intentional failure");

		rpc.client.close();
	});

	test("msgpack: echo and ping", async () => {
		const rpc = new SockaSession({
			contract: roundtripContract,
			url: `ws://127.0.0.1:${portMsgpack}`,
			wireFormat: "msgpack",
		});
		await rpc.client.waitForOpen();

		await expect(rpc.send.echo({ text: "bin" })).resolves.toEqual({
			text: "bin",
		});
		await expect(rpc.send.ping()).resolves.toEqual({ pong: true });

		rpc.client.close();
	});
});
