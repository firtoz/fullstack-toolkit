import { describe, expect, test } from "bun:test";
import * as z from "zod";
import * as v from "valibot";
import {
	defineSocka,
	type InferSockaRpc,
	type InferSockaHandlers,
	type InferSockaEventHandlers,
} from "./contract";

const messageSchema = z.object({
	id: z.string(),
	body: z.string(),
});

const contract = defineSocka({
	procedures: {
		list: {
			output: z.array(messageSchema),
		},
		echo: {
			input: z.object({ text: z.string() }),
			output: z.object({ text: z.string() }),
		},
		insert: {
			input: z.object({ message: messageSchema }),
			output: z.void(),
		},
	},
	events: {
		itemsChanged: z.array(messageSchema),
	},
});

describe("defineSocka", () => {
	test("preserves procedure definitions at runtime", () => {
		expect(Object.keys(contract.procedures)).toEqual([
			"list",
			"echo",
			"insert",
		]);
		expect(contract.procedures.list.output).toBeDefined();
		expect(contract.procedures.echo.input).toBeDefined();
		expect(contract.procedures.echo.output).toBeDefined();
	});

	test("preserves event definitions at runtime", () => {
		expect(Object.keys(contract.events)).toEqual(["itemsChanged"]);
	});

	test("events defaults to empty object when omitted", () => {
		const noEvents = defineSocka({
			procedures: {
				ping: { output: z.void() },
			},
		});
		expect(Object.keys(noEvents.events)).toEqual([]);
	});
});

describe("InferSockaRpc type inference", () => {
	test("zero-arg function for procedure without input", () => {
		type Rpc = InferSockaRpc<typeof contract>;
		const _typecheck: Rpc["list"] extends () => Promise<
			{ id: string; body: string }[]
		>
			? true
			: false = true;
		expect(_typecheck).toBe(true);
	});

	test("typed input and output for procedure with input", () => {
		type Rpc = InferSockaRpc<typeof contract>;
		const _typecheck: Rpc["echo"] extends (input: {
			text: string;
		}) => Promise<{ text: string }>
			? true
			: false = true;
		expect(_typecheck).toBe(true);
	});

	test("void output for procedure returning void", () => {
		type Rpc = InferSockaRpc<typeof contract>;
		const _typecheck: Rpc["insert"] extends (input: {
			message: { id: string; body: string };
		}) => Promise<void>
			? true
			: false = true;
		expect(_typecheck).toBe(true);
	});
});

describe("InferSockaHandlers type inference", () => {
	test("handler types match contract", () => {
		type Handlers = InferSockaHandlers<typeof contract>;
		const _typecheck: Handlers extends {
			list: () =>
				| { id: string; body: string }[]
				| Promise<{ id: string; body: string }[]>;
			echo: (input: {
				text: string;
			}) => { text: string } | Promise<{ text: string }>;
			insert: (input: {
				message: { id: string; body: string };
			}) => void | Promise<void>;
		}
			? true
			: false = true;
		expect(_typecheck).toBe(true);
	});
});

describe("InferSockaEventHandlers type inference", () => {
	test("event handler types match contract", () => {
		type EventHandlers = InferSockaEventHandlers<typeof contract>;
		const _typecheck: EventHandlers extends {
			itemsChanged: (
				payload: { id: string; body: string }[],
			) => void | Promise<void>;
		}
			? true
			: false = true;
		expect(_typecheck).toBe(true);
	});
});

describe("Valibot schemas work as Standard Schema", () => {
	test("contract accepts Valibot schemas directly", () => {
		const vContract = defineSocka({
			procedures: {
				greet: {
					input: v.object({ name: v.string() }),
					output: v.object({ greeting: v.string() }),
				},
			},
		});
		expect(Object.keys(vContract.procedures)).toEqual(["greet"]);

		type Rpc = InferSockaRpc<typeof vContract>;
		const _typecheck: Rpc["greet"] extends (input: {
			name: string;
		}) => Promise<{ greeting: string }>
			? true
			: false = true;
		expect(_typecheck).toBe(true);
	});
});
