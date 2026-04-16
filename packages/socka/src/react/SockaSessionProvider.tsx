import type { DependencyList, ReactElement, ReactNode, RefObject } from "react";
import { createContext, useContext, useMemo } from "react";
import type { SockaSession } from "../client/SockaSession";
import type { SockaConnectionStatus } from "../client/SockaWebSocketClient";
import type {
	SockaContract,
	SockaContractConfig,
	InferSockaSend,
} from "../core/contract";
import {
	createSockaSendProxyFromSession,
	useSockaSession,
	type UseSockaSessionOptions,
} from "./useSockaSession";

type AnySockaContract = SockaContract<SockaContractConfig>;

/**
 * Session slice stored on React context by {@link SockaSessionProvider}. The typed
 * `send` object is built in {@link useSockaSessionContext} (same as {@link useSockaSession})
 * so children do not open duplicate WebSockets.
 */
export type SockaSessionContextValue<
	TContract extends SockaContract<SockaContractConfig> = AnySockaContract,
> = {
	readonly contract: TContract;
	readonly ready: boolean;
	readonly sessionRef: RefObject<SockaSession<TContract> | null>;
	readonly status: SockaConnectionStatus;
	readonly reconnecting: boolean;
	readonly reconnectAttempt: number;
};

const SockaSessionContext =
	createContext<SockaSessionContextValue<AnySockaContract> | null>(null);

function contextMatchesContract<
	TContract extends SockaContract<SockaContractConfig>,
>(
	ctx: SockaSessionContextValue<AnySockaContract>,
	contract: TContract,
): ctx is SockaSessionContextValue<TContract> {
	return ctx.contract === contract;
}

export type SockaSessionProviderProps<
	TContract extends SockaContract<SockaContractConfig>,
> = {
	readonly contract: TContract;
	readonly deps: DependencyList;
	readonly children: ReactNode;
} & UseSockaSessionOptions<TContract>;

/**
 * Owns a single {@link SockaSession} / WebSocket and exposes it to descendants via
 * {@link useSockaSessionContext}. Mount once per connection (e.g. layout); avoid
 * calling {@link useSockaSession} in every leaf—use the context hook instead.
 */
export function SockaSessionProvider<
	TContract extends SockaContract<SockaContractConfig>,
>(props: SockaSessionProviderProps<TContract>): ReactElement {
	const { contract, deps, children, ...sessionOptions } = props;
	const value = useSockaSession(contract, sessionOptions, deps);
	const merged: SockaSessionContextValue<TContract> = {
		contract,
		ready: value.ready,
		sessionRef: value.sessionRef,
		status: value.status,
		reconnecting: value.reconnecting,
		reconnectAttempt: value.reconnectAttempt,
	};
	return (
		<SockaSessionContext.Provider value={merged}>
			{children}
		</SockaSessionContext.Provider>
	);
}

SockaSessionProvider.displayName = "SockaSessionProvider";

/**
 * Reads the socka session from the nearest {@link SockaSessionProvider}.
 * Pass the **same** `contract` reference as the provider for typing and validation.
 */
export function useSockaSessionContext<
	TContract extends SockaContract<SockaContractConfig>,
>(
	contract: TContract,
): {
	ready: boolean;
	send: InferSockaSend<TContract>;
	sessionRef: RefObject<SockaSession<TContract> | null>;
	status: SockaConnectionStatus;
	reconnecting: boolean;
	reconnectAttempt: number;
} {
	const ctx = useContext(SockaSessionContext);
	if (ctx === null) {
		throw new Error(
			"useSockaSessionContext must be used within a SockaSessionProvider",
		);
	}
	if (!contextMatchesContract(ctx, contract)) {
		throw new Error(
			"useSockaSessionContext: `contract` must be the same reference as SockaSessionProvider's `contract`",
		);
	}
	const send = useMemo(
		() => createSockaSendProxyFromSession(contract, ctx.sessionRef),
		[contract, ctx.sessionRef],
	);
	return {
		ready: ctx.ready,
		send,
		sessionRef: ctx.sessionRef,
		status: ctx.status,
		reconnecting: ctx.reconnecting,
		reconnectAttempt: ctx.reconnectAttempt,
	};
}
