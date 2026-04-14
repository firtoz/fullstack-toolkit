import { describe, expect, test } from "bun:test";
import * as z from "zod";
import * as v from "valibot";
import {
	defineSocka,
	type InferSockaSend,
	type InferSockaHandlers,
	type InferSockaPushHandlers,
} from "./contract";

const messageSchema = z.object({
	id: z.string(),
	body: z.string(),
});

const contract = defineSocka({
	calls: {
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
	pushes: {
		itemsChanged: z.array(messageSchema),
	},
});

describe("defineSocka", () => {
	test("preserves call definitions at runtime", () => {
		expect(Object.keys(contract.calls)).toEqual(["list", "echo", "insert"]);
		expect(contract.calls.list.output).toBeDefined();
		expect(contract.calls.echo.input).toBeDefined();
		expect(contract.calls.echo.output).toBeDefined();
	});

	test("preserves push definitions at runtime", () => {
		expect(Object.keys(contract.pushes)).toEqual(["itemsChanged"]);
	});

	test("allows call names that match SockaSession field names (they live under send)", () => {
		const c = defineSocka({
			calls: {
				close: { output: z.void() },
				client: { output: z.string() },
				send: { output: z.number() },
			},
		});
		expect(Object.keys(c.calls).sort()).toEqual(["client", "close", "send"]);
	});

	test("pushes defaults to empty object when omitted", () => {
		const noPushes = defineSocka({
			calls: {
				ping: { output: z.void() },
			},
		});
		expect(Object.keys(noPushes.pushes)).toEqual([]);
	});
});

describe("InferSockaSend type inference", () => {
	test("zero-arg function for call without input", () => {
		type Send = InferSockaSend<typeof contract>;
		const _typecheck: Send["list"] extends () => Promise<
			{ id: string; body: string }[]
		>
			? true
			: false = true;
		expect(_typecheck).toBe(true);
	});

	test("typed input and output for call with input", () => {
		type Send = InferSockaSend<typeof contract>;
		const _typecheck: Send["echo"] extends (input: {
			text: string;
		}) => Promise<{ text: string }>
			? true
			: false = true;
		expect(_typecheck).toBe(true);
	});

	test("void output for call returning void", () => {
		type Send = InferSockaSend<typeof contract>;
		const _typecheck: Send["insert"] extends (input: {
			message: { id: string; body: string };
		}) => Promise<void>
			? true
			: false = true;
		expect(_typecheck).toBe(true);
	});
});

describe("InferSockaHandlers type inference", () => {
	test("handler types match contract", () => {
		type Session = { readonly _sessionBrand?: unique symbol };
		type Handlers = InferSockaHandlers<typeof contract, Session>;
		const _typecheck: Handlers extends {
			list: (
				session: Session,
			) =>
				| { id: string; body: string }[]
				| Promise<{ id: string; body: string }[]>;
			echo: (
				input: {
					text: string;
				},
				session: Session,
			) => { text: string } | Promise<{ text: string }>;
			insert: (
				input: {
					message: { id: string; body: string };
				},
				session: Session,
			) => void | Promise<void>;
		}
			? true
			: false = true;
		expect(_typecheck).toBe(true);
	});
});

describe("InferSockaPushHandlers type inference", () => {
	test("push handler types match contract", () => {
		type PushHandlers = InferSockaPushHandlers<typeof contract>;
		const _typecheck: PushHandlers extends {
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
			calls: {
				greet: {
					input: v.object({ name: v.string() }),
					output: v.object({ greeting: v.string() }),
				},
			},
		});
		expect(Object.keys(vContract.calls)).toEqual(["greet"]);

		type Send = InferSockaSend<typeof vContract>;
		const _typecheck: Send["greet"] extends (input: {
			name: string;
		}) => Promise<{ greeting: string }>
			? true
			: false = true;
		expect(_typecheck).toBe(true);
	});
});
