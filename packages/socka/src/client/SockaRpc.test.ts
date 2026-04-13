import { describe, expect, mock, test } from "bun:test";
import {
	encodeServerError,
	encodeServerEvent,
	encodeServerResponse,
} from "../core/envelope";
import { encodeSockaWire } from "../core/wire-codec";
import { SockaError } from "../core/socka-error";
import { rpcTestContract } from "../test-utils/rpc-contract-for-tests";
import { createFakeWebSocket } from "../test-utils/fake-websocket";
import { SockaRpc } from "./SockaRpc";

describe("SockaRpc", () => {
	test("rejects call when WebSocket is not open", async () => {
		const { socket } = createFakeWebSocket(WebSocket.CONNECTING);
		const rpc = new SockaRpc({
			contract: rpcTestContract,
			webSocket: socket,
		});
		await expect(rpc.rpc.echo({ text: "a" })).rejects.toThrow(
			"WebSocket not connected",
		);
	});

	test("full echo round-trip with captured request id", async () => {
		const { socket, dispatchMessage, dispatchOpen, sent } =
			createFakeWebSocket();
		dispatchOpen();
		const rpc = new SockaRpc({
			contract: rpcTestContract,
			webSocket: socket,
		});

		const p = rpc.rpc.echo({ text: "hello" });
		expect(sent.length).toBe(1);
		const req = JSON.parse(sent[0] as string);
		expect(req.socka).toBe("clientRequest");
		const id = req.id as string;

		dispatchMessage(
			encodeSockaWire(
				encodeServerResponse(id, "echo", { text: "hello" }),
				"json",
			) as string,
		);

		await expect(p).resolves.toEqual({ text: "hello" });
	});

	test("server error frame rejects with SockaError", async () => {
		const { socket, dispatchMessage, dispatchOpen, sent } =
			createFakeWebSocket();
		dispatchOpen();
		const rpc = new SockaRpc({ contract: rpcTestContract, webSocket: socket });
		const p = rpc.rpc.ping();
		const req = JSON.parse(sent[0] as string);
		const id = req.id as string;
		dispatchMessage(
			encodeSockaWire(encodeServerError(id, "nope"), "json") as string,
		);
		const err = await p.catch((e: unknown) => e);
		expect(err).toBeInstanceOf(SockaError);
		expect((err as SockaError).message).toBe("nope");
		expect((err as SockaError).requestId).toBe(id);
	});

	test("unknown procedure in response rejects", async () => {
		const { socket, dispatchMessage, dispatchOpen, sent } =
			createFakeWebSocket();
		dispatchOpen();
		const rpc = new SockaRpc({ contract: rpcTestContract, webSocket: socket });
		const p = rpc.rpc.echo({ text: "a" });
		const id = (JSON.parse(sent[0] as string) as { id: string }).id;
		dispatchMessage(
			encodeSockaWire(
				encodeServerResponse(id, "notARealProc", { x: 1 }),
				"json",
			) as string,
		);
		await expect(p).rejects.toThrow("Unknown procedure");
	});

	test("orphan server response does not throw", () => {
		const { socket, dispatchMessage, dispatchOpen } = createFakeWebSocket();
		dispatchOpen();
		new SockaRpc({ contract: rpcTestContract, webSocket: socket });
		expect(() =>
			dispatchMessage(
				encodeSockaWire(
					encodeServerResponse("ghost-id", "echo", { text: "x" }),
					"json",
				) as string,
			),
		).not.toThrow();
	});

	test("eventHandlers receives validated notify payload", async () => {
		const { socket, dispatchMessage, dispatchOpen } = createFakeWebSocket();
		dispatchOpen();
		let seen: unknown;
		new SockaRpc({
			contract: rpcTestContract,
			webSocket: socket,
			eventHandlers: {
				notify: (payload) => {
					seen = payload;
				},
			},
		});
		dispatchMessage(
			encodeSockaWire(
				encodeServerEvent("notify", { msg: "e" }),
				"json",
			) as string,
		);
		await new Promise((r) => setTimeout(r, 0));
		expect(seen).toEqual({ msg: "e" });
	});

	test("event validation failure logs to console.error", async () => {
		const { socket, dispatchMessage, dispatchOpen } = createFakeWebSocket();
		dispatchOpen();
		const spy = mock(() => {});
		const original = console.error;
		console.error = spy;
		try {
			new SockaRpc({
				contract: rpcTestContract,
				webSocket: socket,
				eventHandlers: { notify: () => {} },
			});
			dispatchMessage(
				encodeSockaWire(
					encodeServerEvent("notify", { bad: true }),
					"json",
				) as string,
			);
			await new Promise((r) => setTimeout(r, 10));
			expect(spy.mock.calls.length).toBeGreaterThan(0);
		} finally {
			console.error = original;
		}
	});

	test("rejectAllPending rejects all pending calls", async () => {
		const { socket, dispatchOpen, sent } = createFakeWebSocket();
		dispatchOpen();
		const rpc = new SockaRpc({ contract: rpcTestContract, webSocket: socket });
		const p1 = rpc.rpc.echo({ text: "a" });
		const p2 = rpc.rpc.ping();
		expect(sent.length).toBe(2);
		rpc.rejectAllPending(new Error("bye"));
		await expect(p1).rejects.toThrow("bye");
		await expect(p2).rejects.toThrow("bye");
	});
});
