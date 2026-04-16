import { describe, expect, test } from "bun:test";
import {
	SOCKA_WIRE_VERSION,
	SockaWireError,
	decodeSockaWire,
	encodeClientRequest,
	encodeServerResponse,
	encodeServerError,
	encodeServerEvent,
} from "./envelope";

describe("decodeSockaWire", () => {
	test("rejects payloads without socka discriminator", () => {
		expect(() => decodeSockaWire({ type: "list", id: "a" })).toThrow(
			SockaWireError,
		);
	});

	test("rejects non-object payloads", () => {
		expect(() => decodeSockaWire("hello")).toThrow(SockaWireError);
		expect(() => decodeSockaWire(42)).toThrow(SockaWireError);
		expect(() => decodeSockaWire(null)).toThrow(SockaWireError);
	});

	test("rejects wrong wire version", () => {
		expect(() =>
			decodeSockaWire({
				socka: "clientRequest",
				v: 99,
				id: "a",
				rpc: "x",
				body: {},
			}),
		).toThrow(SockaWireError);
	});

	test("decodes clientRequest", () => {
		const frame = encodeClientRequest("l-1", "list", {});
		const d = decodeSockaWire(frame);
		expect(d.kind).toBe("clientRequest");
		if (d.kind === "clientRequest") {
			expect(d.frame.id).toBe("l-1");
			expect(d.frame.rpc).toBe("list");
			expect(d.frame.body).toEqual({});
		}
	});

	test("decodes serverResponse", () => {
		const frame = encodeServerResponse("l-1", "list", [{ id: "m1" }]);
		const d = decodeSockaWire(frame);
		expect(d.kind).toBe("serverResponse");
		if (d.kind === "serverResponse") {
			expect(d.frame.id).toBe("l-1");
			expect(d.frame.rpc).toBe("list");
			expect(d.frame.body).toEqual([{ id: "m1" }]);
		}
	});

	test("decodes serverError", () => {
		const frame = encodeServerError("i-1", "duplicate key");
		const d = decodeSockaWire(frame);
		expect(d.kind).toBe("serverError");
		if (d.kind === "serverError") {
			expect(d.frame.id).toBe("i-1");
			expect(d.frame.error).toBe("duplicate key");
		}
	});

	test("decodes serverEvent", () => {
		const frame = encodeServerEvent("itemsChanged", [1, 2, 3]);
		const d = decodeSockaWire(frame);
		expect(d.kind).toBe("serverEvent");
		if (d.kind === "serverEvent") {
			expect(d.frame.event).toBe("itemsChanged");
			expect(d.frame.body).toEqual([1, 2, 3]);
		}
	});
});

describe("encode helpers", () => {
	test("encodeClientRequest round-trips via decode", () => {
		const frame = encodeClientRequest("i-1", "insert", {
			message: { x: 1 },
		});
		const roundTrip: unknown = JSON.parse(JSON.stringify(frame));
		const d = decodeSockaWire(roundTrip);
		expect(d.kind).toBe("clientRequest");
		if (d.kind === "clientRequest") {
			expect(d.frame.rpc).toBe("insert");
			expect(d.frame.body).toEqual({ message: { x: 1 } });
		}
	});

	test("encodeServerResponse round-trips via decode", () => {
		const frame = encodeServerResponse("l-1", "list", []);
		const roundTrip: unknown = JSON.parse(JSON.stringify(frame));
		const d = decodeSockaWire(roundTrip);
		expect(d.kind).toBe("serverResponse");
		if (d.kind === "serverResponse") {
			expect(d.frame.rpc).toBe("list");
			expect(d.frame.body).toEqual([]);
		}
	});

	test("encodeServerError round-trips via decode", () => {
		const frame = encodeServerError("x-1", "fail");
		const roundTrip: unknown = JSON.parse(JSON.stringify(frame));
		const d = decodeSockaWire(roundTrip);
		expect(d.kind).toBe("serverError");
	});

	test("encodeServerError optional code and data round-trip", () => {
		const frame = encodeServerError("x-2", "nope", {
			code: "E_TEST",
			data: { retryAfter: 5 },
		});
		const roundTrip: unknown = JSON.parse(JSON.stringify(frame));
		const d = decodeSockaWire(roundTrip);
		expect(d.kind).toBe("serverError");
		if (d.kind === "serverError") {
			expect(d.frame.code).toBe("E_TEST");
			expect(d.frame.data).toEqual({ retryAfter: 5 });
		}
	});

	test("encodeServerEvent round-trips via decode", () => {
		const frame = encodeServerEvent("notify", { count: 5 });
		const roundTrip: unknown = JSON.parse(JSON.stringify(frame));
		const d = decodeSockaWire(roundTrip);
		expect(d.kind).toBe("serverEvent");
		if (d.kind === "serverEvent") {
			expect(d.frame.event).toBe("notify");
			expect(d.frame.body).toEqual({ count: 5 });
		}
	});

	test("all frames have correct wire version", () => {
		expect(encodeClientRequest("a", "b", {}).v).toBe(SOCKA_WIRE_VERSION);
		expect(encodeServerResponse("a", "b", null).v).toBe(SOCKA_WIRE_VERSION);
		expect(encodeServerError("a", "b").v).toBe(SOCKA_WIRE_VERSION);
		expect(encodeServerEvent("a", null).v).toBe(SOCKA_WIRE_VERSION);
	});
});
