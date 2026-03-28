import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { connectPartialSync } from "../connect-partial-sync";
import { PartialSyncClientBridge } from "../partial-sync-client-bridge";
import type { PartialSyncState } from "../partial-sync-client-bridge";
import type { SyncClientMessage } from "../sync-protocol";
import {
	assertSyncUtils,
	getPartialSyncRowByMapId,
	primePartialSyncBridgeCachedIdsFromCollection,
} from "./partial-sync-utils";
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

	const collectionRef = useRef(collection);
	collectionRef.current = collection;

	const bridge = useMemo(
		() =>
			new PartialSyncClientBridge<TItem>({
				clientId: partialClientId,
				...(collectionId !== undefined ? { collectionId } : {}),
				collection: {
					get: (key) =>
						getPartialSyncRowByMapId(collectionRef.current, key),
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

	/**
	 * Keep the object returned by `subscribeChanges` and call `.unsubscribe()` on it. Destructuring
	 * `{ unsubscribe }` drops the method receiver, so TanStack's `unsubscribe()` runs with `this === undefined`
	 * and throws (e.g. reading `truncateCleanup`).
	 *
	 * Declare this layout effect before the WebSocket one so teardown runs `unsubscribe` before
	 * `disconnect` (layout cleanups run in declaration order in practice).
	 */
	useLayoutEffect(() => {
		primePartialSyncBridgeCachedIdsFromCollection(bridge, collection);
		let cancelled = false;
		let seeded = false;
		const trySeed = () => {
			if (cancelled || seeded) return;
			const rows = Array.from(collection.entries(), ([, v]) => v);
			if (rows.length === 0) return;
			bridge.seedHydratedLocalRows(rows);
			seeded = true;
		};
		const changeSubscription = collection.subscribeChanges(trySeed, {
			includeInitialState: true,
		});
		queueMicrotask(trySeed);
		let intervalId: ReturnType<typeof setInterval> | undefined;
		intervalId = setInterval(() => {
			trySeed();
			if (seeded && intervalId !== undefined) {
				clearInterval(intervalId);
				intervalId = undefined;
			}
		}, 50);
		const stopId = setTimeout(() => {
			if (intervalId !== undefined) {
				clearInterval(intervalId);
			}
		}, 10_000);
		return () => {
			cancelled = true;
			changeSubscription.unsubscribe();
			if (intervalId !== undefined) clearInterval(intervalId);
			clearTimeout(stopId);
		};
	}, [bridge, collection]);

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
