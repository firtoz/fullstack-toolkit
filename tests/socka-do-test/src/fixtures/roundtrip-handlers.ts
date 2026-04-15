import { SockaError } from "socka/core";

/** Shared handlers for socka integration tests. */
export const roundtripHandlers = {
	echo: async (input: { text: string }) => ({ text: input.text }),
	ping: async () => ({ pong: true as const }),
	fail: async () => {
		throw new SockaError("intentional failure");
	},
} as const;
