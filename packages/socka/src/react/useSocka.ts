import type { DependencyList, RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import type { SockaContract, SockaContractConfig } from "../core/contract";
import { SockaRpc, type SockaRpcOptions } from "../client/SockaRpc";

/** Options for {@link useSocka}. */
export type UseSockaOptions<
	TContract extends SockaContract<SockaContractConfig>,
> = SockaRpcOptions<TContract>;

/**
 * Connects a {@link SockaRpc} in an effect: rejects all pending RPCs and closes
 * the socket on cleanup or when `deps` change.
 */
export function useSocka<TContract extends SockaContract<SockaContractConfig>>(
	options: UseSockaOptions<TContract>,
	deps: DependencyList,
): {
	ready: boolean;
	sessionRef: RefObject<SockaRpc<TContract> | null>;
} {
	const { onOpen, onClose, ...restOptions } = options;

	const onOpenRef = useRef(onOpen);
	onOpenRef.current = onOpen;
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;

	const [ready, setReady] = useState(false);
	const sessionRef = useRef<SockaRpc<TContract> | null>(null);

	useEffect(() => {
		let cancelled = false;
		setReady(false);

		const session = new SockaRpc<TContract>({
			...restOptions,
			onOpen: (event) => {
				if (!cancelled) {
					setReady(true);
				}
				onOpenRef.current?.(event);
			},
			onClose: (event) => {
				if (!cancelled) {
					setReady(false);
				}
				onCloseRef.current?.(event);
			},
		});

		sessionRef.current = session;
		void session.client.connect().then(
			() => {
				if (!cancelled) {
					setReady(true);
				}
			},
			() => {
				/* connect failure: onError / onClose handle UX */
			},
		);

		return () => {
			cancelled = true;
			sessionRef.current = null;
			session.rejectAllPending(new Error("WebSocket closed"));
			session.close();
		};
	}, deps); // deps: explicit reconnect contract for useSocka (see hook docs)

	return { ready, sessionRef };
}
