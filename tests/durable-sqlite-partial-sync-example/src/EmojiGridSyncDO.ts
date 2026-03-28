import type {
	RangeCondition,
	SyncRange,
	SyncServerBridgeStore,
} from "@firtoz/collection-sync";
import { QueryableDurableObject } from "@firtoz/drizzle-durable-sqlite";
import type { SyncMessage } from "@firtoz/db-helpers";
import { exhaustiveGuard } from "@firtoz/maybe-error";
import type { Context } from "hono";
import {
	and,
	asc,
	count,
	desc,
	eq,
	gt,
	gte,
	lt,
	lte,
	max,
	ne,
} from "drizzle-orm";
import type { InferSelectModel, SQL } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import superjson from "superjson";
import emojiMigrations from "../drizzle-emoji/migrations.js";
import * as schema from "./emoji-grid-schema";

type EmojiGridRow = InferSelectModel<typeof schema.emojiGridTable>;
type EmojiGridId = EmojiGridRow["id"];

const SEED_ROW_COUNT = 1000;

const DEMO_EMOJIS = [
	"😀",
	"😺",
	"🐶",
	"🦊",
	"🐸",
	"🐼",
	"🦁",
	"🐯",
	"🐻",
	"🐨",
	"🐵",
	"🦄",
	"🐝",
	"🦋",
	"🐢",
	"🐙",
	"🦑",
	"🌸",
	"🌲",
	"⭐",
	"🌙",
	"⚡",
	"🔥",
	"💧",
	"🎮",
	"🎸",
	"🎨",
	"🚀",
	"🛸",
	"🍕",
	"🍦",
] as const;

function pickRandomEmoji(): string {
	return DEMO_EMOJIS[Math.floor(Math.random() * DEMO_EMOJIS.length)] ?? "😀";
}

export class EmojiGridSyncDO extends QueryableDurableObject<
	EmojiGridRow,
	typeof schema.emojiGridSchema
> {
	override readonly app = this.getBaseApp()
		.get("/health", (c: Context) => c.text("ok"))
		.post("/demo/randomize-visible", async (c: Context) => {
			const body = (await c.req.json().catch(() => ({}))) as {
				rowIds?: unknown;
			};
			const rowIds = (Array.isArray(body.rowIds) ? body.rowIds : [])
				.filter((id): id is string => typeof id === "string")
				.slice(0, 5);
			await this.randomizeVisibleEmojiRows(rowIds);
			return c.json({ ok: true as const, updated: rowIds.length });
		});

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env, {
			schema: schema.emojiGridSchema,
			migrations: emojiMigrations,
			queryChunkSize: 200,
			seedInBackground: true,
			serializeJson: (value: unknown) => superjson.stringify(value),
			deserializeJson: (raw: string) => superjson.parse(raw),
		});
	}

	async randomizeVisibleEmojiRows(rowIds: string[]): Promise<void> {
		const changes: SyncMessage<EmojiGridRow>[] = [];
		for (const id of rowIds.slice(0, 5)) {
			const prev = await this.#getEmojiRow(id);
			if (prev === undefined) continue;
			const next: EmojiGridRow = {
				...prev,
				emoji: pickRandomEmoji(),
				health: Math.floor(Math.random() * 101),
				updatedAt: new Date(),
			};
			await this.db
				.update(schema.emojiGridTable)
				.set({
					emoji: next.emoji,
					health: next.health,
					updatedAt: next.updatedAt,
				})
				.where(eq(schema.emojiGridTable.id, id as EmojiGridId));
			await this.#appendChangelog("update", id, {
				value: next,
				previousValue: prev,
			});
			changes.push({
				type: "update",
				value: next,
				previousValue: prev,
			});
		}
		if (changes.length > 0) {
			await this.pushServerChanges(changes);
		}
	}

	protected override createClientMutationSyncStore(): SyncServerBridgeStore<EmojiGridRow> {
		return {
			applySyncMessages: (messages) => this.#applyEmojiSyncMessages(messages),
			getSnapshotMessages: () => this.#getEmojiSnapshotMessages(),
			getRow: (key) => this.#getEmojiRow(key),
		};
	}

	async #appendChangelog(
		operation: "insert" | "update" | "delete",
		rowId: string,
		payload: unknown,
	): Promise<void> {
		const version = new Date();
		await this.db.insert(schema.emojiGridChangelogTable).values({
			rowId,
			operation,
			version,
			payloadJson:
				payload === null || payload === undefined
					? null
					: superjson.stringify(payload),
		});
	}

	async #applyEmojiSyncMessages(
		messages: SyncMessage<EmojiGridRow>[],
	): Promise<void> {
		for (const message of messages) {
			switch (message.type) {
				case "insert":
					await this.db.insert(schema.emojiGridTable).values(message.value);
					await this.#appendChangelog(
						"insert",
						message.value.id,
						message.value,
					);
					break;
				case "update":
					await this.db
						.update(schema.emojiGridTable)
						.set({
							x: message.value.x,
							y: message.value.y,
							emoji: message.value.emoji,
							name: message.value.name,
							health: message.value.health,
							updatedAt: message.value.updatedAt,
							deletedAt: message.value.deletedAt,
						})
						.where(
							eq(schema.emojiGridTable.id, message.value.id as EmojiGridId),
						);
					await this.#appendChangelog("update", message.value.id, {
						value: message.value,
						previousValue: message.previousValue,
					});
					break;
				case "delete":
					await this.db
						.delete(schema.emojiGridTable)
						.where(eq(schema.emojiGridTable.id, message.key as EmojiGridId));
					await this.#appendChangelog("delete", String(message.key), null);
					break;
				case "truncate":
					await this.db.delete(schema.emojiGridChangelogTable);
					await this.db.delete(schema.emojiGridTable);
					break;
				default:
					exhaustiveGuard(message);
			}
		}
	}

	async #getEmojiRow(key: string | number): Promise<EmojiGridRow | undefined> {
		const rows = await this.db
			.select()
			.from(schema.emojiGridTable)
			.where(eq(schema.emojiGridTable.id, String(key) as EmojiGridId))
			.limit(1);
		return rows[0];
	}

	async #getEmojiSnapshotMessages(): Promise<SyncMessage<EmojiGridRow>[]> {
		const rows = await this.db.select().from(schema.emojiGridTable);
		return rows.map((row) => ({ type: "insert" as const, value: row }));
	}

	protected override async *queryRange(options: {
		sort: { column: string; direction: "asc" | "desc" };
		limit: number;
		afterCursor: unknown | null;
		chunkSize: number;
	}): AsyncIterable<EmojiGridRow[]> {
		let remaining = options.limit;
		let cursor = options.afterCursor;
		const sortColumn =
			options.sort.column === "y"
				? schema.emojiGridTable.y
				: schema.emojiGridTable.x;
		while (remaining > 0) {
			const currentLimit = Math.min(options.chunkSize, remaining);
			const directionExpr =
				options.sort.direction === "asc" ? asc(sortColumn) : desc(sortColumn);
			const whereCursor =
				cursor === null
					? undefined
					: options.sort.direction === "asc"
						? gt(sortColumn, cursor as never)
						: lt(sortColumn, cursor as never);
			const rows = await this.db
				.select()
				.from(schema.emojiGridTable)
				.where(whereCursor ? and(whereCursor) : undefined)
				.orderBy(directionExpr, asc(schema.emojiGridTable.id))
				.limit(currentLimit);
			if (rows.length === 0) break;
			yield rows as EmojiGridRow[];
			remaining -= rows.length;
			if (rows.length < currentLimit) break;
			cursor = rows[rows.length - 1][options.sort.column as "x" | "y"];
		}
	}

	protected override async *queryByOffset(options: {
		sort: { column: string; direction: "asc" | "desc" };
		limit: number;
		offset: number;
		chunkSize: number;
	}): AsyncIterable<EmojiGridRow[]> {
		let remaining = options.limit;
		let sqlOffset = options.offset;
		const sortColumn =
			options.sort.column === "y"
				? schema.emojiGridTable.y
				: schema.emojiGridTable.x;
		while (remaining > 0) {
			const currentLimit = Math.min(options.chunkSize, remaining);
			const directionExpr =
				options.sort.direction === "asc" ? asc(sortColumn) : desc(sortColumn);
			const rows = await this.db
				.select()
				.from(schema.emojiGridTable)
				.orderBy(directionExpr, asc(schema.emojiGridTable.id))
				.limit(currentLimit)
				.offset(sqlOffset);
			if (rows.length === 0) break;
			yield rows as EmojiGridRow[];
			remaining -= rows.length;
			sqlOffset += rows.length;
			if (rows.length < currentLimit) break;
		}
	}

	protected override async getTotalCount(): Promise<number> {
		const rows = await this.db
			.select({ count: count() })
			.from(schema.emojiGridTable);
		return rows[0]?.count ?? 0;
	}

	protected override getSortValue(row: EmojiGridRow, column: string): unknown {
		if (column === "y") return row.y;
		if (column === "x") return row.x;
		return row.x;
	}

	#columnRef(column: string): SQLiteColumn {
		if (column === "x") return schema.emojiGridTable.x;
		if (column === "y") return schema.emojiGridTable.y;
		if (column === "emoji") return schema.emojiGridTable.emoji;
		if (column === "name") return schema.emojiGridTable.name;
		if (column === "health") return schema.emojiGridTable.health;
		throw new Error(`Unsupported predicate column: ${column}`);
	}

	#coercePredicateScalar(column: string, value: unknown): string | number {
		if (column === "x" || column === "y" || column === "health") {
			const n = Number(value);
			if (!Number.isFinite(n)) {
				throw new Error(`Predicate ${column} value must be a finite number`);
			}
			return Math.trunc(n);
		}
		return String(value);
	}

	#predicateCondition(condition: RangeCondition): SQL {
		const col = this.#columnRef(condition.column);
		switch (condition.op) {
			case "eq":
				return eq(
					col,
					this.#coercePredicateScalar(condition.column, condition.value),
				);
			case "neq":
				return ne(
					col,
					this.#coercePredicateScalar(condition.column, condition.value),
				);
			case "gt":
				return gt(
					col,
					this.#coercePredicateScalar(condition.column, condition.value),
				);
			case "gte":
				return gte(
					col,
					this.#coercePredicateScalar(condition.column, condition.value),
				);
			case "lt":
				return lt(
					col,
					this.#coercePredicateScalar(condition.column, condition.value),
				);
			case "lte":
				return lte(
					col,
					this.#coercePredicateScalar(condition.column, condition.value),
				);
			case "between": {
				const from = this.#coercePredicateScalar(
					condition.column,
					condition.value,
				);
				const to = this.#coercePredicateScalar(
					condition.column,
					condition.valueTo,
				);
				return and(gte(col, from), lte(col, to)) as SQL;
			}
			default:
				exhaustiveGuard(condition.op);
		}
	}

	#predicateWhere(conditions: RangeCondition[]): SQL | undefined {
		if (conditions.length === 0) return undefined;
		const parts = conditions.map((c) => this.#predicateCondition(c));
		return parts.length === 1 ? parts[0] : (and(...parts) as SQL);
	}

	protected override async *queryByPredicate(options: {
		conditions: RangeCondition[];
		sort?: { column: string; direction: "asc" | "desc" };
		limit?: number;
		chunkSize: number;
	}): AsyncIterable<EmojiGridRow[]> {
		const limit = options.limit ?? options.chunkSize;
		let remaining = limit;
		let offset = 0;
		const where = this.#predicateWhere(options.conditions);
		const sortColumn =
			options.sort?.column === "y"
				? schema.emojiGridTable.y
				: schema.emojiGridTable.x;
		const directionExpr =
			options.sort?.direction === "desc" ? desc(sortColumn) : asc(sortColumn);
		while (remaining > 0) {
			const currentLimit = Math.min(options.chunkSize, remaining);
			const rows = await this.db
				.select()
				.from(schema.emojiGridTable)
				.where(where)
				.orderBy(directionExpr, asc(schema.emojiGridTable.id))
				.limit(currentLimit)
				.offset(offset);
			if (rows.length === 0) break;
			yield rows as EmojiGridRow[];
			remaining -= rows.length;
			offset += rows.length;
			if (rows.length < currentLimit) break;
		}
	}

	protected override async getPredicateCount(
		conditions: RangeCondition[],
	): Promise<number> {
		const where = this.#predicateWhere(conditions);
		const rows = await this.db
			.select({ c: count() })
			.from(schema.emojiGridTable)
			.where(where);
		return rows[0]?.c ?? 0;
	}

	protected override async changesSince(options: {
		range: SyncRange;
		sinceVersion: number;
		chunkSize: number;
	}): Promise<{
		changes: SyncMessage<EmojiGridRow>[];
		totalCount: number;
	} | null> {
		void options.range;
		const totalCount = await this.getTotalCount();
		const maxRow = await this.db
			.select({ m: max(schema.emojiGridTable.updatedAt) })
			.from(schema.emojiGridTable);
		const m = maxRow[0]?.m;
		const maxMs = m instanceof Date ? m.getTime() : Number(m ?? 0);
		if (options.sinceVersion >= maxMs) {
			return { changes: [], totalCount };
		}
		const logRows = await this.db
			.select()
			.from(schema.emojiGridChangelogTable)
			.where(
				gt(
					schema.emojiGridChangelogTable.version,
					new Date(options.sinceVersion),
				),
			);
		if (logRows.length === 0) {
			return null;
		}
		const changes: SyncMessage<EmojiGridRow>[] = [];
		for (const entry of logRows) {
			const op = entry.operation;
			if (op !== "insert" && op !== "update" && op !== "delete") {
				throw new Error(`Unknown changelog operation: ${op}`);
			}
			switch (op) {
				case "delete":
					changes.push({ type: "delete", key: entry.rowId });
					break;
				case "insert": {
					if (entry.payloadJson === null) break;
					const value = superjson.parse(entry.payloadJson) as EmojiGridRow;
					changes.push({ type: "insert", value });
					break;
				}
				case "update": {
					if (entry.payloadJson === null) break;
					const parsed = superjson.parse(entry.payloadJson) as {
						value: EmojiGridRow;
						previousValue: EmojiGridRow;
					};
					changes.push({
						type: "update",
						value: parsed.value,
						previousValue: parsed.previousValue,
					});
					break;
				}
				default:
					exhaustiveGuard(op);
			}
		}
		return { changes, totalCount };
	}

	protected override async seedData(): Promise<void> {
		const existing = await this.getTotalCount();
		if (existing >= SEED_ROW_COUNT) return;
		const ts = Date.now();
		const toInsert: Array<typeof schema.emojiGridTable.$inferInsert> = [];
		for (let i = 0; i < SEED_ROW_COUNT; i += 1) {
			toInsert.push({
				x: Math.floor(Math.random() * 1000),
				y: Math.floor(Math.random() * 1000),
				emoji: pickRandomEmoji(),
				name: `Unit-${i}`,
				health: Math.floor(Math.random() * 101),
				createdAt: new Date(ts),
				updatedAt: new Date(ts),
				deletedAt: null,
			});
		}
		// Durable Object SQLite enforces a low max bound-parameter count per statement.
		// Multi-row INSERT uses ~one placeholder per column per row; keep batches small.
		const ROWS_PER_INSERT = 8;
		const chunks: Array<(typeof toInsert)[number][]> = [];
		for (let i = 0; i < toInsert.length; i += ROWS_PER_INSERT) {
			chunks.push(toInsert.slice(i, i + ROWS_PER_INSERT));
		}
		await Promise.all(
			chunks.map((slice) => this.db.insert(schema.emojiGridTable).values(slice)),
		);
	}
}
