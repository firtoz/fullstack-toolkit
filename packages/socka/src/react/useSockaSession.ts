import { useMemo, type DependencyList, type RefObject } from "react";
import type { SockaContract, SockaContractConfig } from "../core/contract";
import type { InferSockaSend, InferSockaPushHandlers } from "../core/contract";
import type { SockaSession } from "../client/SockaSession";
import type { SockaConnectionStatus } from "../client/SockaWebSocketClient";
import { useSocka, type UseSockaOptions } from "./useSocka";

export type UseSockaSessionOptions<
	TContract extends SockaContract<SockaContractConfig>,
> = Omit<UseSockaOptions<TContract>, "contract" | "pushHandlers"> & {
	pushHandlers?: Partial<InferSockaPushHandlers<TContract>>;
};

/**
 * Builds the same typed `send` object as {@link useSockaSession} from a live session ref.
 * Used by {@link useSockaSessionContext} so consumers do not open extra connections.
 */
export function createSockaSendProxyFromSession<
	TContract extends SockaContract<SockaContractConfig>,
>(
	contract: TContract,
	sessionRef: RefObject<SockaSession<TContract> | null>,
): InferSockaSend<TContract> {
	const proxy: Record<string, unknown> = {};
	for (const name of Object.keys(contract.calls)) {
		proxy[name] = (...args: unknown[]) => {
			const session = sessionRef.current;
			if (!session) {
				return Promise.reject(
					new Error("socka: session ref is null; cannot send"),
				);
			}
			const fn = session.send[name as keyof typeof session.send] as (
				...a: unknown[]
			) => Promise<unknown>;
			return fn.apply(session.send, args);
		};
	}
	return proxy as InferSockaSend<TContract>;
}

/**
 * ```tsx
 * const { ready, send } = useSockaSession(myContract, { url }, deps);
 * await send.echo({ message: "hi" });
 * ```
 */
export function useSockaSession<
	TContract extends SockaContract<SockaContractConfig>,
>(
	contract: TContract,
	options: UseSockaSessionOptions<TContract>,
	deps: DependencyList,
): {
	ready: boolean;
	send: InferSockaSend<TContract>;
	sessionRef: RefObject<SockaSession<TContract> | null>;
	status: SockaConnectionStatus;
	reconnecting: boolean;
	reconnectAttempt: number;
} {
	const { pushHandlers, ...sockaOpts } = options;
	const { ready, sessionRef, status, reconnecting, reconnectAttempt } =
		useSocka(
			{
				...sockaOpts,
				contract,
				pushHandlers,
			},
			deps,
		);

	const send = useMemo(
		() => createSockaSendProxyFromSession(contract, sessionRef),
		[contract, sessionRef],
	);

	return {
		ready,
		send,
		sessionRef,
		status,
		reconnecting,
		reconnectAttempt,
	};
}
