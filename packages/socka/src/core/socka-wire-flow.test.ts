import { describe, expect, test } from "bun:test";
import * as z from "zod";
import {
	decodeSockaWire,
	encodeClientRequest,
	encodeServerResponse,
	encodeServerError,
	encodeServerEvent,
	SockaWireError,
} from "./envelope";
import { parseStandardSchema } from "./validate";
import { defineSocka, type InferSockaSend } from "./contract";

const contract = defineSocka({
	calls: {
		list: {
			output: z.array(z.object({ id: z.string(), text: z.string() })),
		},
		insert: {
			input: z.object({ text: z.string() }),
			output: z.void(),
		},
	},
	pushes: {
		notify: z.object({ count: z.number() }),
	},
});

describe("socka wire flow (integration)", () => {
	test("clientRequest frame survives JSON round-trip", () => {
		const wire = encodeClientRequest("l-1", "list", {});
		const roundTrip: unknown = JSON.parse(JSON.stringify(wire));
		const decoded = decodeSockaWire(roundTrip);
		expect(decoded.kind).toBe("clientRequest");
		if (decoded.kind === "clientRequest") {
			expect(decoded.frame.rpc).toBe("list");
			expect(decoded.frame.body).toEqual({});
		}
	});

	test("serverResponse frame round-trips and validates against output schema", async () => {
		const body = [{ id: "m1", text: "hello" }];
		const wire = encodeServerResponse("l-1", "list", body);
		const roundTrip: unknown = JSON.parse(JSON.stringify(wire));
		const decoded = decodeSockaWire(roundTrip);
		expect(decoded.kind).toBe("serverResponse");
		if (decoded.kind === "serverResponse") {
			const validated = await parseStandardSchema(
				contract.calls.list.output,
				decoded.frame.body,
			);
			expect(validated).toEqual(body);
		}
	});

	test("serverEvent frame carries event name and body", async () => {
		const wire = encodeServerEvent("notify", { count: 3 });
		const roundTrip: unknown = JSON.parse(JSON.stringify(wire));
		const decoded = decodeSockaWire(roundTrip);
		expect(decoded.kind).toBe("serverEvent");
		if (decoded.kind === "serverEvent") {
			expect(decoded.frame.event).toBe("notify");
			const validated = await parseStandardSchema(
				contract.pushes.notify,
				decoded.frame.body,
			);
			expect(validated).toEqual({ count: 3 });
		}
	});

	test("serverError frame carries error message", () => {
		const wire = encodeServerError("i-1", "duplicate key");
		const roundTrip: unknown = JSON.parse(JSON.stringify(wire));
		const decoded = decodeSockaWire(roundTrip);
		expect(decoded.kind).toBe("serverError");
		if (decoded.kind === "serverError") {
			expect(decoded.frame.error).toBe("duplicate key");
		}
	});

	test("plain JSON without socka envelope is rejected", () => {
		expect(() => decodeSockaWire({ text: "hello", id: "1" })).toThrow(
			SockaWireError,
		);
	});

	test("input validation rejects bad data", async () => {
		const proc = contract.calls.insert;
		if (!proc.input) throw new Error("insert should have input");
		await expect(
			parseStandardSchema(proc.input, { text: 42 }),
		).rejects.toThrow();
	});

	test("InferSockaSend produces correct function types", () => {
		type Send = InferSockaSend<typeof contract>;

		const _listCheck: Send["list"] extends () => Promise<
			{ id: string; text: string }[]
		>
			? true
			: false = true;

		const _insertCheck: Send["insert"] extends (input: {
			text: string;
		}) => Promise<void>
			? true
			: false = true;

		expect(_listCheck && _insertCheck).toBe(true);
	});
});
