import { describe, expect, mock, test } from "bun:test";
import {
	encodeServerError,
	encodeServerEvent,
	encodeServerResponse,
} from "../core/envelope";
import { encodeSockaWire } from "../core/wire-codec";
import type { SockaReportError } from "../core/socka-report-error";
import { SockaError } from "../core/socka-error";
import { rpcTestContract } from "../test-utils/rpc-contract-for-tests";
import { createFakeWebSocket } from "../test-utils/fake-websocket";
import { SockaRpc } from "./SockaRpc";

describe("SockaRpc", () => {
	test("rejects call when connection fails before open", async () => {
		const { socket, dispatchError } = createFakeWebSocket(WebSocket.CONNECTING);
		const rpc = new SockaRpc({
			contract: rpcTestContract,
			webSocket: socket,
		});
		const p = rpc.rpc.echo({ text: "a" });
		queueMicrotask(() => {
			dispatchError();
		});
		await expect(p).rejects.toThrow("WebSocket connection failed");
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
		await Promise.resolve();
		await Promise.resolve();
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
		await Promise.resolve();
		await Promise.resolve();
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
		await Promise.resolve();
		await Promise.resolve();
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

	test("reportError receives clientEventValidation when event payload invalid", async () => {
		const { socket, dispatchMessage, dispatchOpen } = createFakeWebSocket();
		dispatchOpen();
		const reportError = mock((_event: SockaReportError) => {});
		new SockaRpc({
			contract: rpcTestContract,
			webSocket: socket,
			eventHandlers: { notify: () => {} },
			reportError,
		});
		dispatchMessage(
			encodeSockaWire(
				encodeServerEvent("notify", { bad: true }),
				"json",
			) as string,
		);
		await new Promise((r) => setTimeout(r, 10));
		expect(reportError.mock.calls.length).toBe(1);
		const ev = reportError.mock.calls[0][0];
		expect(ev).toEqual(
			expect.objectContaining({
				kind: "clientEventValidation",
				eventName: "notify",
			}),
		);
		expect(ev.error).toBeInstanceOf(Error);
	});

	test("reportError receives clientEventListener when handler throws", async () => {
		const { socket, dispatchMessage, dispatchOpen } = createFakeWebSocket();
		dispatchOpen();
		const reportError = mock((_event: SockaReportError) => {});
		const rpc = new SockaRpc({
			contract: rpcTestContract,
			webSocket: socket,
			reportError,
		});
		rpc.events.on("notify", () => {
			throw new Error("boom");
		});
		dispatchMessage(
			encodeSockaWire(
				encodeServerEvent("notify", { msg: "e" }),
				"json",
			) as string,
		);
		await new Promise((r) => setTimeout(r, 0));
		expect(reportError.mock.calls.length).toBe(1);
		const ev = reportError.mock.calls[0][0];
		expect(ev).toEqual(
			expect.objectContaining({
				kind: "clientEventListener",
				eventName: "notify",
			}),
		);
		if (!(ev.error instanceof Error)) {
			throw new Error("expected listener error to be Error");
		}
		expect(ev.error.message).toBe("boom");
	});

	test("events.on receives validated notify payload", async () => {
		const { socket, dispatchMessage, dispatchOpen } = createFakeWebSocket();
		dispatchOpen();
		let seen: unknown;
		const rpc = new SockaRpc({
			contract: rpcTestContract,
			webSocket: socket,
		});
		rpc.events.on("notify", (payload) => {
			seen = payload;
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

	test("events.once fires only once", async () => {
		const { socket, dispatchMessage, dispatchOpen } = createFakeWebSocket();
		dispatchOpen();
		let count = 0;
		const rpc = new SockaRpc({
			contract: rpcTestContract,
			webSocket: socket,
		});
		rpc.events.once("notify", () => {
			count += 1;
		});
		const wire = encodeSockaWire(
			encodeServerEvent("notify", { msg: "a" }),
			"json",
		) as string;
		dispatchMessage(wire);
		dispatchMessage(wire);
		await new Promise((r) => setTimeout(r, 0));
		expect(count).toBe(1);
	});

	test("events.waitForEvent resolves with payload", async () => {
		const { socket, dispatchMessage, dispatchOpen } = createFakeWebSocket();
		dispatchOpen();
		const rpc = new SockaRpc({
			contract: rpcTestContract,
			webSocket: socket,
		});
		const p = rpc.events.waitForEvent("notify");
		dispatchMessage(
			encodeSockaWire(
				encodeServerEvent("notify", { msg: "w" }),
				"json",
			) as string,
		);
		await expect(p).resolves.toEqual({ msg: "w" });
	});

	test("events.waitForEvent respects predicate", async () => {
		const { socket, dispatchMessage, dispatchOpen } = createFakeWebSocket();
		dispatchOpen();
		const rpc = new SockaRpc({
			contract: rpcTestContract,
			webSocket: socket,
		});
		const p = rpc.events.waitForEvent("notify", {
			predicate: (x) => x.msg === "b",
		});
		dispatchMessage(
			encodeSockaWire(
				encodeServerEvent("notify", { msg: "a" }),
				"json",
			) as string,
		);
		dispatchMessage(
			encodeSockaWire(
				encodeServerEvent("notify", { msg: "b" }),
				"json",
			) as string,
		);
		await expect(p).resolves.toEqual({ msg: "b" });
	});

	test("events.waitForEvent aborts with signal", async () => {
		const { socket, dispatchOpen } = createFakeWebSocket();
		dispatchOpen();
		const rpc = new SockaRpc({
			contract: rpcTestContract,
			webSocket: socket,
		});
		const ac = new AbortController();
		const p = rpc.events.waitForEvent("notify", { signal: ac.signal });
		ac.abort();
		await expect(p).rejects.toBeInstanceOf(DOMException);
	});

	test("rejectAllPending rejects all pending calls", async () => {
		const { socket, dispatchOpen, sent } = createFakeWebSocket();
		dispatchOpen();
		const rpc = new SockaRpc({ contract: rpcTestContract, webSocket: socket });
		const p1 = rpc.rpc.echo({ text: "a" });
		const p2 = rpc.rpc.ping();
		await Promise.resolve();
		await Promise.resolve();
		expect(sent.length).toBe(2);
		rpc.rejectAllPending(new Error("bye"));
		await expect(Promise.all([p1, p2])).rejects.toThrow("bye");
	});
});
