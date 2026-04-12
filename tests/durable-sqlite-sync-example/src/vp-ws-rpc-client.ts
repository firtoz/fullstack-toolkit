import type { DependencyList, RefObject } from "react";
import type { InferSockaRpc } from "socka/core";
import type { SockaRpc } from "socka/client";
import { useSockaRpc, type UseSockaRpcOptions } from "socka/react";
import { vpContract } from "./vp-ws-protocol";

export type VpWsRpc = InferSockaRpc<typeof vpContract>;

/**
 * Virtual-props WebSocket RPC hook driven by {@link vpContract}.
 * Returns typed `rpc.list()` / `rpc.insert(...)` with zero casts.
 */
export function useVpWsSockaRpc(
	options: UseSockaRpcOptions<typeof vpContract>,
	deps: DependencyList,
): {
	ready: boolean;
	rpc: VpWsRpc;
	sessionRef: RefObject<SockaRpc<typeof vpContract> | null>;
} {
	return useSockaRpc(vpContract, options, deps);
}
