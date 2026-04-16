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
			input: z.object({ message: z.string() }),
			output: z.object({ response: z.string() }),
		},
	},
});

type Send = InferSockaSend<typeof contract>;
type Handlers = InferSockaHandlers<typeof contract, unknown>;

void (async () => {
	const _send: Send = {} as Send;
	const _handlers: Handlers = {
		echo: async (input) => ({ response: input.message }),
	};
	void _send;
	void _handlers;
	console.log("minimal socka types OK");
})();
