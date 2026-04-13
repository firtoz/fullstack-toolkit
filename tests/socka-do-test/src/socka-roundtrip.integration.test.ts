import { exports } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import { SockaError } from "socka/core";
import { SockaRpc, SockaWebSocketClient } from "socka/client";
import { roundtripContract } from "./fixtures/roundtrip-contract";
import "./fixtures/worker";

describe("socka DO round-trip", () => {
	it("JSON: echo and ping", async () => {
		const response = await exports.default.fetch(
			"http://example.com/socka-json/websocket",
			{ headers: { Upgrade: "websocket" } },
		);
		const ws = response.webSocket;
		if (!ws) throw new Error("expected webSocket");
		ws.accept();

		const rpc = new SockaRpc({
			contract: roundtripContract,
			webSocket: ws,
			wireFormat: "json",
		});
		await rpc.client.waitForOpen();

		await expect(rpc.rpc.echo({ text: "hello" })).resolves.toEqual({
			text: "hello",
		});
		await expect(rpc.rpc.ping()).resolves.toEqual({ pong: true });
	});

	it("JSON: handler SockaError surfaces on client", async () => {
		const response = await exports.default.fetch(
			"http://example.com/socka-json/websocket",
			{ headers: { Upgrade: "websocket" } },
		);
		const ws = response.webSocket;
		if (!ws) throw new Error("expected webSocket");
		ws.accept();

		const rpc = new SockaRpc({
			contract: roundtripContract,
			webSocket: ws,
			wireFormat: "json",
		});
		await rpc.client.waitForOpen();

		const err = await rpc.rpc.fail().catch((e: unknown) => e);
		expect(err).toBeInstanceOf(SockaError);
		expect((err as SockaError).message).toBe("intentional failure");
	});

	it("JSON: unknown procedure returns server error", async () => {
		const response = await exports.default.fetch(
			"http://example.com/socka-json/websocket",
			{ headers: { Upgrade: "websocket" } },
		);
		const ws = response.webSocket;
		if (!ws) throw new Error("expected webSocket");
		ws.accept();

		const errors: string[] = [];
		const client = new SockaWebSocketClient({
			contract: roundtripContract,
			webSocket: ws,
			wireFormat: "json",
			onServerError: (f) => errors.push(f.error),
		});
		await client.waitForOpen();
		client.sendRequest("u1", "noSuchProcedure", {});

		await vi.waitFor(
			() => {
				expect(errors.length).toBe(1);
			},
			{ timeout: 2000, interval: 20 },
		);
		expect(errors[0]).toContain("Unknown procedure");
	});

	it("Hono Cloudflare Workers (socka/hono/cloudflare): JSON echo and ping", async () => {
		const response = await exports.default.fetch(
			"http://example.com/hono-socka-ws",
			{ headers: { Upgrade: "websocket" } },
		);
		const ws = response.webSocket;
		if (!ws) throw new Error("expected webSocket");
		ws.accept();

		const rpc = new SockaRpc({
			contract: roundtripContract,
			webSocket: ws,
			wireFormat: "json",
		});
		await rpc.client.waitForOpen();

		await expect(rpc.rpc.echo({ text: "hono" })).resolves.toEqual({
			text: "hono",
		});
		await expect(rpc.rpc.ping()).resolves.toEqual({ pong: true });
	});

	it("msgpack: echo", async () => {
		const response = await exports.default.fetch(
			"http://example.com/socka-msgpack/websocket",
			{ headers: { Upgrade: "websocket" } },
		);
		const ws = response.webSocket;
		if (!ws) throw new Error("expected webSocket");
		ws.accept();

		const rpc = new SockaRpc({
			contract: roundtripContract,
			webSocket: ws,
			wireFormat: "msgpack",
		});
		await rpc.client.waitForOpen();

		await expect(rpc.rpc.echo({ text: "bin" })).resolves.toEqual({
			text: "bin",
		});
	});
});
