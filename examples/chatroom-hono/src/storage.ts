import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ChatMessageRow } from "./contract";

const DATA_DIR = join(process.cwd(), "data");

const chains = new Map<string, Promise<unknown>>();

function withRoom<T>(roomId: string, fn: () => Promise<T>): Promise<T> {
	const prev = chains.get(roomId) ?? Promise.resolve();
	const next = prev.then(fn);
	chains.set(roomId, next.then(() => {}).catch(() => {}));
	return next;
}

async function loadRoom(roomId: string): Promise<ChatMessageRow[]> {
	const path = roomPath(roomId);
	try {
		const raw = await readFile(path, "utf8");
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed as ChatMessageRow[];
	} catch {
		return [];
	}
}

function roomPath(roomId: string): string {
	const safe = encodeURIComponent(roomId);
	return join(DATA_DIR, `${safe}.json`);
}

export function listMessages(roomId: string, limit: number): Promise<ChatMessageRow[]> {
	return withRoom(roomId, async () => {
		const rows = await loadRoom(roomId);
		return rows.slice(-limit);
	});
}

export function appendMessage(roomId: string, row: ChatMessageRow): Promise<void> {
	return withRoom(roomId, async () => {
		await mkdir(DATA_DIR, { recursive: true });
		const rows = await loadRoom(roomId);
		rows.push(row);
		const path = roomPath(roomId);
		const tmp = `${path}.${process.pid}.tmp`;
		await writeFile(tmp, JSON.stringify(rows), "utf8");
		await rename(tmp, path);
	});
}

export function clearRoom(roomId: string): Promise<void> {
	return withRoom(roomId, async () => {
		await mkdir(DATA_DIR, { recursive: true });
		const path = roomPath(roomId);
		const tmp = `${path}.${process.pid}.tmp`;
		await writeFile(tmp, JSON.stringify([]), "utf8");
		await rename(tmp, path);
	});
}
