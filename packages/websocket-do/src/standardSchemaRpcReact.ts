import type { DependencyList, RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import {
	type StandardSchemaWebSocketRpcSession,
	type StandardSchemaWebSocketRpcSessionConstructorOptions,
	createStandardSchemaWebSocketRpcSession,
} from "./standardSchemaRpc";

/** Options for {@link useStandardSchemaWebSocketRpc} (same as constructor options for {@link StandardSchemaWebSocketRpcSession}). */
export type UseStandardSchemaWebSocketRpcOptions<
	TClientMsg,
	TServerMsg,
	TPending extends { reject: (error: Error) => void },
> = StandardSchemaWebSocketRpcSessionConstructorOptions<
	TClientMsg,
	TServerMsg,
	TPending
>;

/**
 * Connects a {@link StandardSchemaWebSocketRpcSession} in an effect: rejects all pending
 * RPCs and closes the socket on cleanup or when `deps` change.
 *
 * Callback refs keep the latest `onMessage` / `onOpen` / `onClose` without
 * listing them in `deps`, so inline handlers do not reconnect every render.
 *
 * Pass `deps` as the second argument; keep it aligned with values used to
 * build `url` / `webSocket`.
 */
export function useStandardSchemaWebSocketRpc<
	TClientMsg,
	TServerMsg,
	TPending extends { reject: (error: Error) => void },
>(
	options: UseStandardSchemaWebSocketRpcOptions<
		TClientMsg,
		TServerMsg,
		TPending
	>,
	deps: DependencyList,
): {
	ready: boolean;
	sessionRef: RefObject<StandardSchemaWebSocketRpcSession<
		TClientMsg,
		TServerMsg,
		TPending
	> | null>;
} {
	const { onMessage, onOpen, onClose, ...clientOptions } = options;

	const onMessageRef = useRef(onMessage);
	onMessageRef.current = onMessage;
	const onOpenRef = useRef(onOpen);
	onOpenRef.current = onOpen;
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;

	const [ready, setReady] = useState(false);
	const sessionRef = useRef<StandardSchemaWebSocketRpcSession<
		TClientMsg,
		TServerMsg,
		TPending
	> | null>(null);

	useEffect(() => {
		let cancelled = false;
		setReady(false);

		const session = createStandardSchemaWebSocketRpcSession<
			TClientMsg,
			TServerMsg,
			TPending
		>({
			...clientOptions,
			onMessage: (msg, s) => {
				onMessageRef.current(msg, s);
			},
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
		if (session.client.socket.readyState === WebSocket.OPEN) {
			setReady(true);
		}

		return () => {
			cancelled = true;
			sessionRef.current = null;
			session.rejectAllPending(new Error("WebSocket closed"));
			session.close();
		};
		// biome-ignore lint/correctness/useExhaustiveDependencies: deps is the explicit contract
	}, deps);

	return { ready, sessionRef };
}
