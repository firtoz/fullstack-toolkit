import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sockaHonoNodeWs } from "@firtoz/socka/hono";
import {
	createSockaRoomRegistry,
	type SockaWebSocketSessionConfig,
} from "@firtoz/socka/server";
import { ticTacToeContract } from "./contract";
import { TicTacToeGame } from "./game";

type SessionData = { roomId: string };

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "../public");

function makeRoomConfig(
	game: TicTacToeGame,
	roomId: string,
): SockaWebSocketSessionConfig<typeof ticTacToeContract, SessionData> {
	return {
		contract: ticTacToeContract,
		strictUpgradeRequest: true,
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

const app = new Hono();
const { upgradeWebSocket, injectWebSocket } = createNodeWebSocket({ app });

app.get(
	"/ws/:roomId",
	upgradeWebSocket((c) => {
		const roomId = c.req.param("roomId") ?? "default";
		const room = rooms.get(roomId);
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
