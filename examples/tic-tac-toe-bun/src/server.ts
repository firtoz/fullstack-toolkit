import type { ServerWebSocket } from "bun";
import { createSockaBunWebSocketHandlers } from "@firtoz/socka/bun";
import type {
	SockaWebSocketInit,
	SockaWebSocketSession,
	SockaWebSocketSessionConfig,
} from "@firtoz/socka/server";
import { ticTacToeContract } from "./contract";
import { TicTacToeGame } from "./game";

type SessionData = { roomId: string };

type RoomBundle = {
	sessionMap: Map<WebSocket, SockaWebSocketSession<typeof ticTacToeContract, SessionData>>;
	game: TicTacToeGame;
	config: SockaWebSocketSessionConfig<typeof ticTacToeContract, SessionData>;
};

const rooms = new Map<string, RoomBundle>();

function makeRoomConfig(
	game: TicTacToeGame,
	roomId: string,
): SockaWebSocketSessionConfig<typeof ticTacToeContract, SessionData> {
	return {
		contract: ticTacToeContract,
		handlers: {
			join: async (session) => {
				const { player } = game.join(session.websocket);
				const snap = game.snapshot();
				await session.broadcastPush("stateChanged", snap);
				return { ...snap, you: player };
			},
			move: async (input, session) => {
				const snap = game.move(session.websocket, input.row, input.col);
				await session.broadcastPush("stateChanged", snap);
				return snap;
			},
		},
		createData: (init: SockaWebSocketInit) => {
			const u = new URL(init.request?.url ?? "http://_/ws/default");
			const parts = u.pathname.split("/").filter(Boolean);
			const rid =
				parts.length >= 2 && parts[0] === "ws" ? parts[1] : roomId;
			return { roomId: rid };
		},
		handleClose: async (session) => {
			game.release(session.websocket);
		},
	};
}

function getOrCreateRoom(roomId: string): RoomBundle {
	let r = rooms.get(roomId);
	if (!r) {
		const game = new TicTacToeGame();
		const sessionMap: RoomBundle["sessionMap"] = new Map();
		const config = makeRoomConfig(game, roomId);
		r = { sessionMap, game, config };
		rooms.set(roomId, r);
	}
	return r;
}

const { websocket } = createSockaBunWebSocketHandlers({
	resolveScope(ws: ServerWebSocket<{ roomId: string }>) {
		const { roomId } = ws.data;
		const room = getOrCreateRoom(roomId);
		return { sessionMap: room.sessionMap, config: room.config };
	},
});

const server = Bun.serve<{ roomId: string }>({
	port: Number(process.env.PORT ?? 3461),
	async fetch(req, srv) {
		const url = new URL(req.url);
		if (url.pathname.startsWith("/ws/")) {
			const roomId = decodeURIComponent(url.pathname.slice(4)) || "default";
			const upgraded = srv.upgrade(req, { data: { roomId } });
			if (upgraded) return undefined;
			return new Response("WebSocket upgrade failed", { status: 400 });
		}
		if (url.pathname === "/" || url.pathname === "/index.html") {
			return new Response(
				Bun.file(new URL("../public/index.html", import.meta.url)),
				{
					headers: { "content-type": "text/html; charset=utf-8" },
				},
			);
		}
		const asset = new URL(`../public${url.pathname}`, import.meta.url);
		const f = Bun.file(asset);
		if (await f.exists()) {
			return new Response(f);
		}
		return new Response("Not found", { status: 404 });
	},
	websocket,
});

console.log(
	`tic-tac-toe-bun → http://localhost:${server.port}/  (WebSocket /ws/<roomId>)`,
);
