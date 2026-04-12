import type { DependencyList, RefObject } from "react";
import { useMemo } from "react";
import type {
	SockaContract,
	SockaContractConfig,
	InferSockaRpc,
	InferSockaEventHandlers,
} from "../core/contract";
import type { SockaRpc } from "../client/SockaRpc";
import { useSocka, type UseSockaOptions } from "./useSocka";

export type UseSockaRpcOptions<
	TContract extends SockaContract<SockaContractConfig>,
> = Omit<UseSockaOptions<TContract>, "contract" | "eventHandlers"> & {
	eventHandlers?: Partial<InferSockaEventHandlers<TContract>>;
};

type AnySockaContract = SockaContract<SockaContractConfig>;

/**
 * Builds the same typed `rpc` object as {@link useSockaRpc} from a live session ref.
 * Used by {@link useSockaRpcContext} so consumers do not open extra connections.
 */
export function createSockaRpcProxyFromSession<
	TContract extends SockaContract<SockaContractConfig>,
>(
	contract: TContract,
	sessionRef: RefObject<SockaRpc<AnySockaContract> | null>,
): InferSockaRpc<TContract> {
	const proxy: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
	for (const name of Object.keys(contract.procedures)) {
		proxy[name] = (...args: unknown[]) => {
			const session = sessionRef.current;
			if (!session) {
				return Promise.reject(new Error("WebSocket not connected"));
			}
			const method = session.rpc as Record<
				string,
				((...a: unknown[]) => Promise<unknown>) | undefined
			>;
			const fn = method[name];
			if (!fn) {
				return Promise.reject(new Error(`Unknown procedure: ${name}`));
			}
			return fn(...args);
		};
	}
	return proxy as InferSockaRpc<TContract>;
}

/**
 * Like {@link useSocka} but returns a typed **`rpc`** object derived from the contract.
 *
 * ```ts
 * const { ready, rpc } = useSockaRpc(myContract, { url }, deps);
 * await rpc.list();
 * ```
 */
export function useSockaRpc<
	TContract extends SockaContract<SockaContractConfig>,
>(
	contract: TContract,
	options: UseSockaRpcOptions<TContract>,
	deps: DependencyList,
): {
	ready: boolean;
	rpc: InferSockaRpc<TContract>;
	sessionRef: RefObject<SockaRpc<TContract> | null>;
} {
	const { eventHandlers, ...rest } = options;

	const { ready, sessionRef } = useSocka<TContract>(
		{
			...rest,
			contract,
			eventHandlers,
		},
		deps,
	);

	const rpc = useMemo(
		() => createSockaRpcProxyFromSession(contract, sessionRef),
		[contract, sessionRef],
	);

	return { ready, rpc, sessionRef };
}
