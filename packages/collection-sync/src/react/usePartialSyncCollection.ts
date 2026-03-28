import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { connectPartialSync } from "../connect-partial-sync";
import { PartialSyncClientBridge } from "../partial-sync-client-bridge";
import type { PartialSyncState } from "../partial-sync-client-bridge";
import type { SyncClientMessage } from "../sync-protocol";
import { assertSyncUtils } from "./partial-sync-utils";
import type {
	PartialSyncItem,
	UsePartialSyncCollectionOptions,
	UsePartialSyncCollectionResult,
} from "./types";

/**
 * WebSocket + {@link PartialSyncClientBridge} wiring shared by predicate viewports and custom UIs.
 * Pair with {@link usePartialSyncViewport} for N-dimensional `rangeQuery` + local predicate rows.
 */
export function usePartialSyncCollection<TItem extends PartialSyncItem>({
	collection,
	mutationBridge,
	wsUrl,
	wsTransport = "json",
	serializeJson = JSON.stringify,
	deserializeJson = JSON.parse,
	mergeTransportSend,
	collectionId,
	beforeApplyRows,
}: UsePartialSyncCollectionOptions<TItem>): UsePartialSyncCollectionResult<TItem> {
	const [bridgeState, setBridgeState] = useState<PartialSyncState>({
		status: "offline",
	});

	const syncUtils = useMemo(
		() => assertSyncUtils<TItem>(collection.utils),
		[collection],
	);
	const syncUtilsRef = useRef(syncUtils);
	syncUtilsRef.current = syncUtils;

	const partialClientId = mutationBridge.clientId;

	const bridge = useMemo(
		() =>
			new PartialSyncClientBridge<TItem>({
				clientId: partialClientId,
				...(collectionId !== undefined ? { collectionId } : {}),
				collection: {
					utils: {
						receiveSync: (messages) =>
							syncUtilsRef.current.receiveSync(messages),
					},
				},
				send: () => {},
				onStateChange: (state) => {
					setBridgeState(state);
				},
				...(beforeApplyRows !== undefined ? { beforeApplyRows } : {}),
			}),
		[beforeApplyRows, collectionId, partialClientId],
	);

	const serializeJsonRef = useRef(serializeJson);
	serializeJsonRef.current = serializeJson;
	const deserializeJsonRef = useRef(deserializeJson);
	deserializeJsonRef.current = deserializeJson;
	const mutationBridgeRef = useRef(mutationBridge);
	mutationBridgeRef.current = mutationBridge;
	const mergeTransportSendRef = useRef(mergeTransportSend);
	mergeTransportSendRef.current = mergeTransportSend;

	useLayoutEffect(() => {
		const disconnect = connectPartialSync(bridge, {
			url: wsUrl,
			transport: wsTransport,
			setTransportSend: (send) => {
				bridge.setSend((message: SyncClientMessage) => send(message));
				mergeTransportSendRef.current?.(send);
			},
			serializeJson: (value: unknown) => serializeJsonRef.current(value),
			deserializeJson: (raw: string) => deserializeJsonRef.current(raw),
			mutationBridge: mutationBridgeRef.current,
		});
		return () => {
			disconnect();
		};
	}, [bridge, wsTransport, wsUrl]);

	return { bridge, bridgeState };
}
