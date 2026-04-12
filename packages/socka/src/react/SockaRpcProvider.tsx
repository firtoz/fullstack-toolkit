import type { DependencyList, ReactElement, ReactNode, RefObject } from "react";
import { createContext, useContext, useMemo } from "react";
import type { SockaRpc } from "../client/SockaRpc";
import type {
	SockaContract,
	SockaContractConfig,
	InferSockaRpc,
} from "../core/contract";
import {
	createSockaRpcProxyFromSession,
	useSockaRpc,
	type UseSockaRpcOptions,
} from "./useSockaRpc";

type AnySockaContract = SockaContract<SockaContractConfig>;

/**
 * Session slice stored on React context by {@link SockaRpcProvider}. The typed
 * `rpc` object is built in {@link useSockaRpcContext} (same as {@link useSockaRpc})
 * so children do not open duplicate WebSockets.
 */
export type SockaRpcContextValue<
	TContract extends SockaContract<SockaContractConfig> = AnySockaContract,
> = {
	readonly contract: TContract;
	readonly ready: boolean;
	readonly sessionRef: RefObject<SockaRpc<TContract> | null>;
};

const SockaRpcContext =
	createContext<SockaRpcContextValue<AnySockaContract> | null>(null);

function contextMatchesContract<
	TContract extends SockaContract<SockaContractConfig>,
>(
	ctx: SockaRpcContextValue<AnySockaContract>,
	contract: TContract,
): ctx is SockaRpcContextValue<TContract> {
	return ctx.contract === contract;
}

export type SockaRpcProviderProps<
	TContract extends SockaContract<SockaContractConfig>,
> = {
	readonly contract: TContract;
	readonly deps: DependencyList;
	readonly children: ReactNode;
} & UseSockaRpcOptions<TContract>;

/**
 * Owns a single {@link SockaRpc} / WebSocket and exposes it to descendants via
 * {@link useSockaRpcContext}. Mount once per connection (e.g. layout); avoid
 * calling {@link useSockaRpc} in every leaf—use the context hook instead.
 */
export function SockaRpcProvider<
	TContract extends SockaContract<SockaContractConfig>,
>(props: SockaRpcProviderProps<TContract>): ReactElement {
	const { contract, deps, children, ...rpcOptions } = props;
	const value = useSockaRpc(contract, rpcOptions, deps);
	const merged: SockaRpcContextValue<TContract> = {
		contract,
		ready: value.ready,
		sessionRef: value.sessionRef,
	};
	return (
		<SockaRpcContext.Provider value={merged}>
			{children}
		</SockaRpcContext.Provider>
	);
}

SockaRpcProvider.displayName = "SockaRpcProvider";

/**
 * Reads the socka RPC session from the nearest {@link SockaRpcProvider}.
 * Pass the **same** `contract` reference as the provider for typing and validation.
 */
export function useSockaRpcContext<
	TContract extends SockaContract<SockaContractConfig>,
>(
	contract: TContract,
): {
	ready: boolean;
	rpc: InferSockaRpc<TContract>;
	sessionRef: RefObject<SockaRpc<TContract> | null>;
} {
	const ctx = useContext(SockaRpcContext);
	if (ctx === null) {
		throw new Error(
			"useSockaRpcContext must be used within a SockaRpcProvider",
		);
	}
	if (!contextMatchesContract(ctx, contract)) {
		throw new Error(
			"useSockaRpcContext: `contract` must be the same reference as SockaRpcProvider's `contract`",
		);
	}
	const rpc = useMemo(
		() => createSockaRpcProxyFromSession(contract, ctx.sessionRef),
		[contract, ctx.sessionRef],
	);
	return {
		ready: ctx.ready,
		rpc,
		sessionRef: ctx.sessionRef,
	};
}
