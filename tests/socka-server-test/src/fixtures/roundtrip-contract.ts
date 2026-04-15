import * as z from "zod";
import { defineSocka } from "@firtoz/socka/core";

export const roundtripContract = defineSocka({
	calls: {
		echo: {
			input: z.object({ text: z.string() }),
			output: z.object({ text: z.string() }),
		},
		ping: {
			output: z.object({ pong: z.literal(true) }),
		},
		fail: {
			output: z.void(),
		},
	},
});
