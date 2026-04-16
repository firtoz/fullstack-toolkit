import type { SockaContract, SockaContractConfig } from "../core/contract";
import type { SockaWebSocketSession } from "./SockaWebSocketSession";
import type { SockaWebSocketSessionConfig } from "./SockaWebSocketSessionConfig";

export type SockaRoomBundle<
	TContract extends SockaContract<SockaContractConfig>,
	TData,
> = {
	sessionMap: Map<WebSocket, SockaWebSocketSession<TContract, TData>>;
	config: SockaWebSocketSessionConfig<TContract, TData>;
};

/**
 * Per-room {@link SockaWebSocketSession} maps and configs for Bun/Hono multi-room
 * apps (one bundle per `roomId`).
 */
export function createSockaRoomRegistry<
	TContract extends SockaContract<SockaContractConfig>,
	TData,
>(
	makeConfig: (
		roomId: string,
		sessionMap: Map<WebSocket, SockaWebSocketSession<TContract, TData>>,
	) => SockaWebSocketSessionConfig<TContract, TData>,
): {
	get(roomId: string): SockaRoomBundle<TContract, TData>;
	readonly rooms: ReadonlyMap<string, SockaRoomBundle<TContract, TData>>;
} {
	const rooms = new Map<string, SockaRoomBundle<TContract, TData>>();
	return {
		get(roomId: string): SockaRoomBundle<TContract, TData> {
			let r = rooms.get(roomId);
			if (!r) {
				const sessionMap = new Map<
					WebSocket,
					SockaWebSocketSession<TContract, TData>
				>();
				const config = makeConfig(roomId, sessionMap);
				r = { sessionMap, config };
				rooms.set(roomId, r);
			}
			return r;
		},
		get rooms(): ReadonlyMap<string, SockaRoomBundle<TContract, TData>> {
			return rooms;
		},
	};
}
