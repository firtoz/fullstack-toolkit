import type { SyncServerBridgeStore } from "@firtoz/collection-sync";
import {
	createDrizzleChangelogHelper,
	createDrizzleMutationStore,
	createDrizzlePartialSyncStore,
	type PartialSyncTableConfig,
	QueryableDurableObject,
} from "@firtoz/drizzle-durable-sqlite";
import type { SyncMessage } from "@firtoz/db-helpers";
import { zValidator } from "@hono/zod-validator";
import type { Context } from "hono";
import { count, eq } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import superjson from "superjson";
import emojiMigrations from "../drizzle-emoji/migrations.js";
import { demoRandomizeVisibleJsonSchema } from "./demo-randomize-visible-schema";
import * as schema from "./emoji-grid-schema";
import { EMOJI_GRID_PARTIAL_SYNC_COLLECTION_ID } from "./partial-sync-collection-ids";

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

const emojiColumnConfig = {
	columns: {
		x: { kind: "integer" as const, truncateInteger: true },
		y: { kind: "integer" as const, truncateInteger: true },
		emoji: { kind: "text" as const },
		name: { kind: "text" as const },
		health: { kind: "integer" as const, truncateInteger: true },
	},
	sortableColumns: ["x", "y"] as const,
} satisfies PartialSyncTableConfig<"x" | "y">;

export class EmojiGridSyncDO extends QueryableDurableObject<
	EmojiGridRow,
	typeof schema.emojiGridSchema
> {
	override readonly app = this.getBaseApp()
		.get("/health", (c: Context) => c.text("ok"))
		.post(
			"/demo/randomize-visible",
			zValidator("json", demoRandomizeVisibleJsonSchema),
			async (c) => {
				const { rowIds } = c.req.valid("json");
				const ids = (rowIds ?? []).slice(0, 5);
				await this.randomizeVisibleEmojiRows(ids);
				return c.json({ ok: true as const, updated: ids.length });
			},
		);

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env, {
			schema: schema.emojiGridSchema,
			migrations: emojiMigrations,
			collectionId: EMOJI_GRID_PARTIAL_SYNC_COLLECTION_ID,
			queryChunkSize: 200,
			seedInBackground: true,
			serializeJson: (value: unknown) => superjson.stringify(value),
			deserializeJson: (raw: string) => superjson.parse(raw),
			createPartialSyncStore: (db) => {
				const changelogHelper = createDrizzleChangelogHelper({
					db,
					changelogTable: schema.emojiGridChangelogTable,
					serializeJson: (value: unknown) => superjson.stringify(value),
				});
				return createDrizzlePartialSyncStore({
					db,
					table: schema.emojiGridTable,
					columnConfig: emojiColumnConfig,
					changelogHelper,
					deserializeJson: (raw: string) => superjson.parse(raw),
					updatedAtColumnName: "updatedAt",
				});
			},
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
			const changelog = createDrizzleChangelogHelper({
				db: this.db,
				changelogTable: schema.emojiGridChangelogTable,
				serializeJson: (value: unknown) => superjson.stringify(value),
			});
			await changelog.append("update", id, {
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
		const changelogHelper = createDrizzleChangelogHelper({
			db: this.db,
			changelogTable: schema.emojiGridChangelogTable,
			serializeJson: (value: unknown) => superjson.stringify(value),
		});
		return createDrizzleMutationStore({
			db: this.db,
			table: schema.emojiGridTable,
			changelogHelper,
			updateColumns: [
				"x",
				"y",
				"emoji",
				"name",
				"health",
				"updatedAt",
				"deletedAt",
			],
		});
	}

	async #getEmojiRow(key: string | number): Promise<EmojiGridRow | undefined> {
		const rows = await this.db
			.select()
			.from(schema.emojiGridTable)
			.where(eq(schema.emojiGridTable.id, String(key) as EmojiGridId))
			.limit(1);
		return rows[0];
	}

	protected override async seedData(): Promise<void> {
		const rows = await this.db
			.select({ count: count() })
			.from(schema.emojiGridTable);
		const existing = rows[0]?.count ?? 0;
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
		const ROWS_PER_INSERT = 8;
		const chunks: Array<(typeof toInsert)[number][]> = [];
		for (let i = 0; i < toInsert.length; i += ROWS_PER_INSERT) {
			chunks.push(toInsert.slice(i, i + ROWS_PER_INSERT));
		}
		await Promise.all(
			chunks.map((slice) =>
				this.db.insert(schema.emojiGridTable).values(slice),
			),
		);
	}
}
