import { SockaError } from "socka/core";

/** Shared server-side handlers for JSON/msgpack e2e (ws + Bun). */
export const roundtripHandlers = {
	echo: async (input: { text: string }) => ({
		text: input.text,
	}),
	ping: async () => ({ pong: true as const }),
	fail: async () => {
		throw new SockaError("intentional failure");
	},
} as const;
