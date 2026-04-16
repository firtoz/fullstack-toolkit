import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sockaHonoNodeWs } from "@firtoz/socka/hono";
import type { ChatMessageRow } from "./contract";
import { chatContract } from "./contract";
import { appendMessage, clearRoom, listMessages } from "./storage";
import {
	createSockaRoomRegistry,
	type SockaWebSocketSessionConfig,
} from "@firtoz/socka/server";

type SessionData = { roomId: string; userId: string; displayName: string };

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "../public");

function makeConfig(
	roomId: string,
): SockaWebSocketSessionConfig<typeof chatContract, SessionData> {
	return {
		contract: chatContract,
		createData: (init) => {
			const u = new URL(init.request.url);
			const displayName = u.searchParams.get("name")?.trim() || "anon";
			return { roomId, userId: crypto.randomUUID(), displayName };
		},
		onAttached: async (session) => {
			await session.broadcastPush(
				"userJoined",
				{ userId: session.data.userId, displayName: session.data.displayName },
				true,
			);
		},
		handlers: {
			listHistory: async (input, session) => {
				const lim = input.limit ?? 200;
				const messages = await listMessages(session.data.roomId, lim);
				return { messages };
			},
			listPresence: async (_input, session) => {
				const users = session
					.listPeers()
					.map((d) => ({ userId: d.userId, displayName: d.displayName }));
				users.sort((a, b) => a.displayName.localeCompare(b.displayName));
				return { selfUserId: session.data.userId, users };
			},
			sendMessage: async (input, session) => {
				const row: ChatMessageRow = {
					id: crypto.randomUUID(),
					ts: Date.now(),
					userId: session.data.userId,
					displayName: session.data.displayName,
					text: input.text,
				};
				await appendMessage(session.data.roomId, row);
				await session.broadcastPush("roomMessage", row);
				return { ok: true as const };
			},
			clearHistory: async (_input, session) => {
				await clearRoom(session.data.roomId);
				const ts = Date.now();
				await session.broadcastPush("historyCleared", {
					ts,
					clearedByUserId: session.data.userId,
					clearedByDisplayName: session.data.displayName,
				});
				return { ok: true as const };
			},
		},
		handleClose: async (session) => {
			await session.broadcastPush(
				"userLeft",
				{ userId: session.data.userId, displayName: session.data.displayName },
				true,
			);
		},
	};
}

const rooms = createSockaRoomRegistry<typeof chatContract, SessionData>(
	(roomId, _sessionMap) => makeConfig(roomId),
);

const app = new Hono();
const { upgradeWebSocket, injectWebSocket } = createNodeWebSocket({ app });

app.get(
	"/ws/:roomId",
	upgradeWebSocket((c) => {
		const roomId = c.req.param("roomId") ?? "default";
		const room = rooms.get(roomId);
		return sockaHonoNodeWs(room.config, {
			sessions: room.sessionMap,
		})(c);
	}),
);

app.get("/", async (c) => {
	const html = await readFile(join(publicDir, "index.html"), "utf8");
	return c.text(html, 200, { "Content-Type": "text/html; charset=utf-8" });
});

app.get("/client.js", async (c) => {
	const body = await readFile(join(publicDir, "client.js"));
	return c.body(body, 200, {
		"Content-Type": "application/javascript; charset=utf-8",
	});
});

const port = Number(process.env.PORT ?? 3465);

const server = serve({
	fetch: app.fetch,
	port,
});

injectWebSocket(server);

console.log(
	`chatroom-hono → http://localhost:${port}/  (WebSocket /ws/<roomId>?name=…); JSON files under ./data/`,
);
