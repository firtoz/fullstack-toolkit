import { SockaWebSocketDO } from "@firtoz/socka/do";
import { roundtripContract } from "./roundtrip-contract";
import { roundtripSessionConfig } from "./roundtrip-session-config";

export class SockaJsonTestDO extends SockaWebSocketDO<
	typeof roundtripContract,
	Record<string, never>,
	Env
> {
	protected readonly contract = roundtripContract;
	app = this.getBaseApp();

	protected buildSockaSessionConfig() {
		return roundtripSessionConfig("json");
	}
}
