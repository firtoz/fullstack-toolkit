import { describe, expect, test } from "bun:test";
import {
	decodeSockaWire,
	encodeClientRequest,
	encodeServerError,
	encodeServerEvent,
	encodeServerResponse,
} from "../core/envelope";
import { encodeSockaWire } from "../core/wire-codec";
import { rpcTestContract } from "../test-utils/rpc-contract-for-tests";
import { createFakeWebSocket } from "../test-utils/fake-websocket";
import { SockaWebSocketClient } from "./SockaWebSocketClient";

describe("SockaWebSocketClient", () => {
	test("throws when neither url nor webSocket is provided", () => {
		expect(
			() =>
				new SockaWebSocketClient({
					contract: rpcTestContract,
				} as ConstructorParameters<typeof SockaWebSocketClient>[0]),
		).toThrow("Either 'url' or 'webSocket' must be provided");
	});

	test("JSON: routes serverResponse to onResponse", () => {
		const { socket, dispatchMessage, dispatchOpen } = createFakeWebSocket();
		const responses: unknown[] = [];
		new SockaWebSocketClient({
			contract: rpcTestContract,
			webSocket: socket,
			wireFormat: "json",
			onResponse: (f) => {
				responses.push(f);
			},
		});
		dispatchOpen();
		const wire = encodeSockaWire(
			encodeServerResponse("x-1", "echo", { text: "hi" }),
			"json",
		);
		expect(typeof wire).toBe("string");
		dispatchMessage(wire as string);
		expect(responses.length).toBe(1);
	});

	test("JSON: wrong frame type uses onValidationError", () => {
		const { socket, dispatchMessage, dispatchOpen } = createFakeWebSocket();
		const errors: { err: Error; raw: unknown }[] = [];
		new SockaWebSocketClient({
			contract: rpcTestContract,
			webSocket: socket,
			wireFormat: "json",
			onValidationError: (err, raw) => {
				errors.push({ err, raw });
			},
		});
		dispatchOpen();
		dispatchMessage(new ArrayBuffer(8));
		expect(errors.length).toBe(1);
		expect(errors[0].err.message).toContain("expected JSON text frame");
	});

	test("JSON: serverError and serverEvent callbacks", () => {
		const { socket, dispatchMessage, dispatchOpen } = createFakeWebSocket();
		const errors: unknown[] = [];
		const events: unknown[] = [];
		new SockaWebSocketClient({
			contract: rpcTestContract,
			webSocket: socket,
			wireFormat: "json",
			onServerError: (f) => errors.push(f),
			onEvent: (f) => events.push(f),
		});
		dispatchOpen();
		dispatchMessage(
			encodeSockaWire(encodeServerError("e1", "boom"), "json") as string,
		);
		dispatchMessage(
			encodeSockaWire(
				encodeServerEvent("notify", { msg: "x" }),
				"json",
			) as string,
		);
		expect(errors).toEqual([
			expect.objectContaining({ socka: "serverError", error: "boom" }),
		]);
		expect(events).toEqual([
			expect.objectContaining({ socka: "serverEvent", event: "notify" }),
		]);
	});

	test("JSON: clientRequest from server triggers onValidationError", () => {
		const { socket, dispatchMessage, dispatchOpen } = createFakeWebSocket();
		const errors: Error[] = [];
		new SockaWebSocketClient({
			contract: rpcTestContract,
			webSocket: socket,
			wireFormat: "json",
			onValidationError: (e) => errors.push(e),
		});
		dispatchOpen();
		const bad = encodeSockaWire(
			encodeClientRequest("1", "echo", { text: "a" }),
			"json",
		) as string;
		dispatchMessage(bad);
		expect(
			errors.some((e) => e.message.includes("unexpected clientRequest")),
		).toBe(true);
	});

	test("sendRequest throws when socket is not open", () => {
		const { socket } = createFakeWebSocket(WebSocket.CONNECTING);
		const client = new SockaWebSocketClient({
			contract: rpcTestContract,
			webSocket: socket,
		});
		expect(() => client.sendRequest("id", "echo", { text: "a" })).toThrow(
			"WebSocket is not open",
		);
	});

	test("sendRequest encodes clientRequest on the wire", () => {
		const { socket, sent, dispatchOpen } = createFakeWebSocket();
		const client = new SockaWebSocketClient({
			contract: rpcTestContract,
			webSocket: socket,
			wireFormat: "json",
		});
		dispatchOpen();
		client.sendRequest("my-id", "echo", { text: "x" });
		expect(sent.length).toBe(1);
		const raw = sent[0];
		expect(typeof raw).toBe("string");
		const decoded = decodeSockaWire(JSON.parse(raw as string));
		expect(decoded.kind).toBe("clientRequest");
		if (decoded.kind === "clientRequest") {
			expect(decoded.frame.id).toBe("my-id");
			expect(decoded.frame.rpc).toBe("echo");
			expect(decoded.frame.body).toEqual({ text: "x" });
		}
	});

	test("msgpack: wrong type uses onValidationError", () => {
		const { socket, dispatchMessage, dispatchOpen } = createFakeWebSocket();
		const errors: Error[] = [];
		new SockaWebSocketClient({
			contract: rpcTestContract,
			webSocket: socket,
			wireFormat: "msgpack",
			onValidationError: (e) => errors.push(e),
		});
		dispatchOpen();
		dispatchMessage("not binary");
		expect(errors[0].message).toContain("expected ArrayBuffer");
	});

	test("msgpack: dispatches serverResponse", () => {
		const { socket, dispatchMessage, dispatchOpen } = createFakeWebSocket();
		const received: unknown[] = [];
		new SockaWebSocketClient({
			contract: rpcTestContract,
			webSocket: socket,
			wireFormat: "msgpack",
			onResponse: (f) => received.push(f),
		});
		dispatchOpen();
		const bytes = encodeSockaWire(
			encodeServerResponse("p-1", "ping", { pong: true }),
			"msgpack",
		);
		expect(bytes instanceof Uint8Array).toBe(true);
		const u = bytes as Uint8Array;
		const ab = new ArrayBuffer(u.byteLength);
		new Uint8Array(ab).set(u);
		dispatchMessage(ab);
		expect(received.length).toBe(1);
	});
});
