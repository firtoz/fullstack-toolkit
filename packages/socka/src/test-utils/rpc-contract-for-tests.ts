/**
 * Shared {@link defineSocka} contract for client / React tests (not published).
 */
import * as z from "zod";
import { defineSocka } from "../core/contract";

export const rpcTestContract = defineSocka({
	calls: {
		echo: {
			input: z.object({ text: z.string() }),
			output: z.object({ text: z.string() }),
		},
		ping: {
			output: z.object({ pong: z.literal(true) }),
		},
	},
	pushes: {
		notify: z.object({ msg: z.string() }),
	},
});
