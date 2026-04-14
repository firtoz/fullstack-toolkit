import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sockaHonoNodeWs } from "socka/hono";
import type {
	SockaWebSocketInit,
	SockaWebSocketSession,
	SockaWebSocketSessionConfig,
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "../public");

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

const app = new Hono();
const { upgradeWebSocket, injectWebSocket } = createNodeWebSocket({ app });

app.get(
	"/ws/:roomId",
	upgradeWebSocket((c) => {
		const roomId = c.req.param("roomId") ?? "default";
		const room = getOrCreateRoom(roomId);
		return sockaHonoNodeWs(room.config, { sessions: room.sessionMap })(c);
	}),
);

app.get("/", async (c) => {
	const html = await readFile(join(publicDir, "index.html"), "utf8");
	return c.text(html, 200, {
		"Content-Type": "text/html; charset=utf-8",
	});
});

app.get("/client.js", async (c) => {
	const body = await readFile(join(publicDir, "client.js"));
	return c.body(body, 200, {
		"Content-Type": "application/javascript; charset=utf-8",
	});
});

const port = Number(process.env.PORT ?? 3462);

const server = serve({
	fetch: app.fetch,
	port,
});

injectWebSocket(server);

console.log(
	`tic-tac-toe-hono → http://localhost:${port}/  (WebSocket /ws/<roomId>)`,
);
