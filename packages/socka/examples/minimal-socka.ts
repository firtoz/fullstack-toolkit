/**
 * Minimal runnable example: `bun run example:minimal` from `packages/socka`.
 */
import * as z from "zod";
import {
	defineSocka,
	type InferSockaSend,
	type InferSockaHandlers,
} from "../src/core/contract";

const contract = defineSocka({
	calls: {
		echo: {
			input: z.object({ text: z.string() }),
			output: z.object({ text: z.string() }),
		},
	},
});

type Send = InferSockaSend<typeof contract>;
type Handlers = InferSockaHandlers<typeof contract, unknown>;

void (async () => {
	const _send: Send = {} as Send;
	const _handlers: Handlers = {
		echo: async (input) => ({ text: input.text }),
	};
	void _send;
	void _handlers;
	console.log("minimal socka types OK");
})();
