import type { ServerWebSocket } from "bun";
import { createSockaBunWebSocketHandlers, sockaBunUpgrade } from "@firtoz/socka/bun";
import {
	createSockaRoomRegistry,
	type SockaWebSocketSessionConfig,
} from "@firtoz/socka/server";
import { ticTacToeContract } from "./contract";
import { TicTacToeGame } from "./game";

type SessionData = { roomId: string };

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
		createData: (init) => {
			const u = new URL(init.request.url);
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

const rooms = createSockaRoomRegistry<typeof ticTacToeContract, SessionData>(
	(roomId, _sessionMap) => {
		const game = new TicTacToeGame();
		return makeRoomConfig(game, roomId);
	},
);

type BunWsData = { roomId: string; request: Request };

const { websocket } = createSockaBunWebSocketHandlers({
	resolveScope(ws: ServerWebSocket<BunWsData>) {
		const { roomId } = ws.data;
		const room = rooms.get(roomId);
		return { sessionMap: room.sessionMap, config: room.config };
	},
});

const server = Bun.serve<BunWsData>({
	port: Number(process.env.PORT ?? 3461),
	async fetch(req, srv) {
		const url = new URL(req.url);
		if (url.pathname.startsWith("/ws/")) {
			const roomId = decodeURIComponent(url.pathname.slice(4)) || "default";
			if (sockaBunUpgrade(srv, req, { roomId })) return undefined;
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
