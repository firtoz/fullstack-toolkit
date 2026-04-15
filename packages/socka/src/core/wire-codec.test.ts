import { describe, expect, test } from "bun:test";
import { pack, unpack } from "msgpackr";
import {
	decodeSockaWire,
	encodeClientRequest,
	encodeServerError,
	encodeServerEvent,
	encodeServerResponse,
} from "./envelope";
import { encodeSockaWire, parseWirePayload } from "./wire-codec";

describe("encodeSockaWire / parseWirePayload (msgpack)", () => {
	test("round-trips clientRequest then decodeSockaWire", () => {
		const frame = encodeClientRequest("a-1", "list", {});
		const encoded = encodeSockaWire(frame, "msgpack");
		const u8 = encoded as Uint8Array;
		const parsed = parseWirePayload(u8, "msgpack");
		const decoded = decodeSockaWire(parsed);
		expect(decoded.kind).toBe("clientRequest");
		if (decoded.kind === "clientRequest") {
			expect(decoded.frame).toEqual(frame);
		}
	});

	test("encodeSockaWire msgpack matches pack(same frame)", () => {
		const frame = encodeServerResponse("x", "echo", { text: "hi" });
		const a = encodeSockaWire(frame, "msgpack") as Uint8Array;
		const b = pack(frame) as Uint8Array;
		expect([...a]).toEqual([...b]);
		expect(decodeSockaWire(unpack(a))).toEqual(decodeSockaWire(frame));
	});

	test("serverError and serverEvent frames round-trip", () => {
		for (const f of [
			encodeServerError("e1", "oops"),
			encodeServerEvent("notify", { n: 1 }),
		]) {
			const u8 = encodeSockaWire(f, "msgpack") as Uint8Array;
			const parsed = parseWirePayload(u8, "msgpack");
			const kind = decodeSockaWire(parsed).kind;
			expect(kind === "serverError" || kind === "serverEvent").toBe(true);
		}
	});

	test("JSON mode uses string path", () => {
		const frame = encodeClientRequest("1", "p", {});
		const s = encodeSockaWire(frame, "json") as string;
		expect(typeof s).toBe("string");
		const parsed = parseWirePayload(s, "json");
		expect(decodeSockaWire(parsed).kind).toBe("clientRequest");
	});

	test("parseWirePayload rejects wrong payload type for format", () => {
		expect(() => parseWirePayload(new ArrayBuffer(0), "json")).toThrow(
			/expected a JSON text frame/,
		);
		expect(() => parseWirePayload("{}", "msgpack")).toThrow(
			/expected an ArrayBuffer/,
		);
	});
});
