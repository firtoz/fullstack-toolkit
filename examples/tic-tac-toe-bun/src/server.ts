import { reportSockaError } from "socka/core";
import {
	SockaWebSocketSession,
	dispatchSockaInboundMessage,
	runSockaSessionOnAttached,
	type SockaWebSocketInit,
	type SockaWebSocketSessionConfig,
} from "socka/server";
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
	_game: TicTacToeGame,
): SockaWebSocketSessionConfig<typeof ticTacToeContract, SessionData> {
	const game = _game;
	return {
		contract: ticTacToeContract,
		handlers: {
			join: async (session) => {
				const { player } = game.join(session.websocket);
				const snap = game.snapshot();
				await session.broadcastContractEvent("stateChanged", snap);
				return { ...snap, you: player };
			},
			move: async (input, session) => {
				const snap = game.move(session.websocket, input.row, input.col);
				await session.broadcastContractEvent("stateChanged", snap);
				return snap;
			},
		},
		createData: (init: SockaWebSocketInit) => {
			const u = new URL(init.request?.url ?? "http://_/ws/default");
			const parts = u.pathname.split("/").filter(Boolean);
			const roomId =
				parts.length >= 2 && parts[0] === "ws" ? parts[1] : "default";
			return { roomId };
		},
		handleClose: async () => {},
	};
}

function getOrCreateRoom(roomId: string): RoomBundle {
	let r = rooms.get(roomId);
	if (!r) {
		const game = new TicTacToeGame();
		const sessionMap: RoomBundle["sessionMap"] = new Map();
		const config = makeRoomConfig(game);
		r = { sessionMap, game, config };
		rooms.set(roomId, r);
	}
	return r;
}

const wireFormat = "json" as const;

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
	websocket: {
		open(ws) {
			const { roomId } = ws.data;
			const room = getOrCreateRoom(roomId);
			const domWs = ws as unknown as WebSocket;
			const init: SockaWebSocketInit = {
				request: new Request(`http://localhost/ws/${roomId}`),
			};
			const session = new SockaWebSocketSession(
				domWs,
				room.sessionMap,
				room.config,
				init,
			);
			room.sessionMap.set(domWs, session);
			runSockaSessionOnAttached(room.config, session);
		},
		async message(ws, message) {
			const { roomId } = ws.data;
			const room = rooms.get(roomId);
			if (!room) return;
			const domWs = ws as unknown as WebSocket;
			const session = room.sessionMap.get(domWs);
			if (!session) return;
			try {
				await dispatchSockaInboundMessage(session, wireFormat, message);
			} catch (error) {
				reportSockaError(room.config.reportError, {
					kind: "serverInboundMessage",
					adapter: "bun",
					error,
				});
			}
		},
		async close(ws) {
			const { roomId } = ws.data;
			const room = rooms.get(roomId);
			if (!room) return;
			const domWs = ws as unknown as WebSocket;
			room.sessionMap.delete(domWs);
			room.game.release(domWs);
			try {
				await room.config.handleClose();
			} catch (error) {
				reportSockaError(room.config.reportError, {
					kind: "serverHandleClose",
					error,
				});
			}
		},
	},
});

console.log(
	`tic-tac-toe-bun → http://localhost:${server.port}/  (WebSocket /ws/<roomId>)`,
);
