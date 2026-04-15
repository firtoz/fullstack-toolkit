import type { DependencyList, RefObject } from "react";
import type { InferSockaSend } from "@firtoz/socka/core";
import type { SockaSession } from "@firtoz/socka/client";
import {
	useSockaSession,
	type UseSockaSessionOptions,
} from "@firtoz/socka/react";
import { vpContract } from "./vp-ws-protocol";

export type VpWsSend = InferSockaSend<typeof vpContract>;

/**
 * Virtual-props WebSocket hook driven by {@link vpContract}.
 * Returns typed `send.list()` / `send.insert(...)` with zero casts.
 */
export function useVpWsSockaSession(
	options: UseSockaSessionOptions<typeof vpContract>,
	deps: DependencyList,
): {
	ready: boolean;
	send: VpWsSend;
	sessionRef: RefObject<SockaSession<typeof vpContract> | null>;
} {
	return useSockaSession(vpContract, options, deps);
}
