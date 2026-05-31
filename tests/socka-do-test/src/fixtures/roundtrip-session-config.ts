import { SockaError } from "@firtoz/socka/core";
import type { SockaWireFormat } from "@firtoz/socka/core";
import type { SockaDoSessionConfigInput } from "@firtoz/socka/do";
import type { roundtripContract } from "./roundtrip-contract";

export function roundtripSessionConfig(
	wireFormat: SockaWireFormat,
): SockaDoSessionConfigInput<
	typeof roundtripContract,
	Record<string, never>,
	Env
> {
	return {
		wireFormat,
		handlers: {
			echo: async (input) => ({ text: input.text }),
			ping: async () => ({ pong: true }),
			fail: async () => {
				throw new SockaError("intentional failure");
			},
		},
		handleClose: async () => {},
	};
}
