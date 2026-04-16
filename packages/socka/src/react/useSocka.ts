import type { DependencyList, RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import type { SockaContract, SockaContractConfig } from "../core/contract";
import { SockaSession, type SockaSessionOptions } from "../client/SockaSession";
import type { SockaConnectionStatus } from "../client/SockaWebSocketClient";

/** Options for {@link useSocka}. */
export type UseSockaOptions<
	TContract extends SockaContract<SockaContractConfig>,
> = SockaSessionOptions<TContract>;

/**
 * Connects a {@link SockaSession} in an effect: rejects all pending calls and closes
 * the socket on cleanup or when `deps` change.
 */
export function useSocka<TContract extends SockaContract<SockaContractConfig>>(
	options: UseSockaOptions<TContract>,
	deps: DependencyList,
): {
	ready: boolean;
	sessionRef: RefObject<SockaSession<TContract> | null>;
	status: SockaConnectionStatus;
	reconnecting: boolean;
	reconnectAttempt: number;
} {
	const { onOpen, onClose, onReconnecting, onReconnected, ...restOptions } =
		options;

	const onOpenRef = useRef(onOpen);
	onOpenRef.current = onOpen;
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;
	const onReconnectingRef = useRef(onReconnecting);
	onReconnectingRef.current = onReconnecting;
	const onReconnectedRef = useRef(onReconnected);
	onReconnectedRef.current = onReconnected;

	const [ready, setReady] = useState(false);
	const [status, setStatus] = useState<SockaConnectionStatus>(() =>
		options.autoConnect === false ? "idle" : "connecting",
	);
	const [reconnectAttempt, setReconnectAttempt] = useState(0);
	const sessionRef = useRef<SockaSession<TContract> | null>(null);

	useEffect(() => {
		let cancelled = false;
		setReady(false);
		setReconnectAttempt(0);

		const session = new SockaSession({
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
			onReconnecting: (info) => {
				setReconnectAttempt(info.attempt);
				onReconnectingRef.current?.(info);
			},
			onReconnected: (info) => {
				setReconnectAttempt(0);
				onReconnectedRef.current?.(info);
			},
		});

		const unsubStatus = session.onStatusChange((s) => {
			if (!cancelled) setStatus(s);
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
			unsubStatus();
			sessionRef.current = null;
			session.rejectAllPending(new Error("WebSocket closed"));
			session.close();
		};
	}, deps); // deps: explicit reconnect contract for useSocka (see hook docs)

	return {
		ready,
		sessionRef,
		status,
		reconnecting: status === "reconnecting",
		reconnectAttempt,
	};
}
