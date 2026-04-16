import type { ServerWebSocket } from "bun";
import { Database } from "bun:sqlite";
import { createSockaBunWebSocketHandlers } from "@firtoz/socka/bun";
import type {
	ChatMessageRow,
} from "./contract";
import { chatContract } from "./contract";
import type {
	SockaWebSocketSession,
	SockaWebSocketSessionConfig,
} from "@firtoz/socka/server";

type SessionData = { roomId: string; userId: string; displayName: string };

type RoomBundle = {
	sessionMap: Map<WebSocket, SockaWebSocketSession<typeof chatContract, SessionData>>;
	config: SockaWebSocketSessionConfig<typeof chatContract, SessionData>;
};

const rooms = new Map<string, RoomBundle>();

const db = new Database("./data/chat.sqlite", { create: true });
db.run(`
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  ts INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  text TEXT NOT NULL
)`);

function listMessagesForRoom(roomId: string, limit: number): ChatMessageRow[] {
	const raw = db
		.prepare(
			`
    SELECT id, ts, user_id, display_name, text
    FROM messages
    WHERE room_id = ?
    ORDER BY ts DESC
    LIMIT ?
  `,
		)
		.all(roomId, limit) as {
			id: string;
			ts: number;
			user_id: string;
			display_name: string;
			text: string;
		}[];
	return raw.reverse().map((r) => ({
		id: r.id,
		ts: r.ts,
		userId: r.user_id,
		displayName: r.display_name,
		text: r.text,
	}));
}

function insertMessage(roomId: string, row: ChatMessageRow): void {
	db.prepare(
		`
    INSERT INTO messages (id, room_id, ts, user_id, display_name, text)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
	).run(row.id, roomId, row.ts, row.userId, row.displayName, row.text);
}

function clearMessagesForRoom(roomId: string): void {
	db.prepare(`DELETE FROM messages WHERE room_id = ?`).run(roomId);
}

function makeConfig(
	roomId: string,
	sessionMap: Map<WebSocket, SockaWebSocketSession<typeof chatContract, SessionData>>,
): SockaWebSocketSessionConfig<typeof chatContract, SessionData> {
	return {
		contract: chatContract,
		strictUpgradeRequest: true,
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
				return { messages: listMessagesForRoom(session.data.roomId, lim) };
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
				insertMessage(session.data.roomId, row);
				await session.broadcastPush("roomMessage", row);
				return { ok: true as const };
			},
			clearHistory: async (_input, session) => {
				clearMessagesForRoom(session.data.roomId);
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

function getOrCreateRoom(roomId: string): RoomBundle {
	let r = rooms.get(roomId);
	if (!r) {
		const sessionMap: RoomBundle["sessionMap"] = new Map();
		const config = makeConfig(roomId, sessionMap);
		r = { sessionMap, config };
		rooms.set(roomId, r);
	}
	return r;
}

type BunWsData = { roomId: string; request: Request };

const { websocket } = createSockaBunWebSocketHandlers({
	resolveScope(ws: ServerWebSocket<BunWsData>) {
		const { roomId } = ws.data;
		const room = getOrCreateRoom(roomId);
		return { sessionMap: room.sessionMap, config: room.config };
	},
});

const server = Bun.serve<BunWsData>({
	port: Number(process.env.PORT ?? 3464),
	async fetch(req, srv) {
		const url = new URL(req.url);
		if (url.pathname.startsWith("/ws/")) {
			const roomId = decodeURIComponent(url.pathname.slice(4)) || "default";
			if (srv.upgrade(req, { data: { roomId, request: req } })) return undefined;
			return new Response("WebSocket upgrade failed", { status: 400 });
		}
		if (url.pathname === "/" || url.pathname === "/index.html") {
			return new Response(Bun.file(new URL("../public/index.html", import.meta.url)), {
				headers: { "content-type": "text/html; charset=utf-8" },
			});
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
	`chatroom-bun → http://localhost:${server.port}/  (WebSocket /ws/<roomId>?name=…); SQLite ./data/chat.sqlite`,
);
