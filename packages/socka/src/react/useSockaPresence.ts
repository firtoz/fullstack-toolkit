import type { DependencyList, RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import type { SockaSession } from "../client/SockaSession";
import type {
	InferSockaPushPayload,
	SockaContract,
	SockaContractConfig,
} from "../core/contract";

export type SockaPresenceOptions<
	TContract extends SockaContract<SockaContractConfig>,
	TUser extends { userId: string },
	KJoin extends keyof TContract["pushes"] & string,
	KLeave extends keyof TContract["pushes"] & string,
> = {
	snapshot: () => Promise<{ selfUserId: string; users: TUser[] }>;
	joinPush: KJoin;
	leavePush: KLeave;
	mapJoinUser: (p: InferSockaPushPayload<TContract, KJoin>) => TUser;
	mapLeaveUserId: (p: InferSockaPushPayload<TContract, KLeave>) => string;
	/** Optional display order after each update (e.g. by `displayName`). */
	sortUsers?: (a: TUser, b: TUser) => number;
};

/**
 * Loads a presence snapshot RPC once, then merges **`joinPush`** / **`leavePush`** deltas.
 * Pass the same **`deps`** you use for {@link useSocka} when room identity changes.
 * Options are read from a ref so you do not need to memoize the **`options`** object.
 */
export function useSockaPresence<
	TContract extends SockaContract<SockaContractConfig>,
	TUser extends { userId: string },
	KJoin extends keyof TContract["pushes"] & string,
	KLeave extends keyof TContract["pushes"] & string,
>(
	sessionRef: RefObject<SockaSession<TContract> | null>,
	ready: boolean,
	options: SockaPresenceOptions<TContract, TUser, KJoin, KLeave>,
	deps: DependencyList,
): {
	users: TUser[];
	selfUserId: string | undefined;
	loading: boolean;
} {
	const [users, setUsers] = useState<TUser[]>([]);
	const [selfUserId, setSelfUserId] = useState<string | undefined>();
	const [loading, setLoading] = useState(true);
	const optionsRef = useRef(options);
	optionsRef.current = options;

	useEffect(() => {
		if (!ready) {
			setUsers([]);
			setSelfUserId(undefined);
			setLoading(true);
			return;
		}

		const s = sessionRef.current;
		if (!s) {
			setLoading(false);
			return;
		}

		const o = optionsRef.current;
		let cancelled = false;

		void (async () => {
			setLoading(true);
			try {
				const snap = await o.snapshot();
				if (cancelled) return;
				setSelfUserId(snap.selfUserId);
				setUsers(o.sortUsers ? [...snap.users].sort(o.sortUsers) : snap.users);
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();

		const onJoin = (p: InferSockaPushPayload<TContract, KJoin>) => {
			const cur = optionsRef.current;
			const u = cur.mapJoinUser(p);
			setUsers((prev) => {
				const next = prev.filter((x) => x.userId !== u.userId);
				const merged = [...next, u];
				return cur.sortUsers ? merged.sort(cur.sortUsers) : merged;
			});
		};

		const onLeave = (p: InferSockaPushPayload<TContract, KLeave>) => {
			const id = optionsRef.current.mapLeaveUserId(p);
			setUsers((prev) => prev.filter((x) => x.userId !== id));
		};

		s.subscribe.on(o.joinPush, onJoin);
		s.subscribe.on(o.leavePush, onLeave);

		return () => {
			cancelled = true;
			s.subscribe.off(o.joinPush, onJoin);
			s.subscribe.off(o.leavePush, onLeave);
		};
	}, [ready, sessionRef, ...deps]);

	return { users, selfUserId, loading };
}
