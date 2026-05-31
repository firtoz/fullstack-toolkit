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
import { count, eq, sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import superjson from "superjson";
import migrations from "../drizzle/migrations";
import { demoRandomizeVisibleJsonSchema } from "./demo-randomize-visible-schema";
import { PEOPLE_PARTIAL_SYNC_COLLECTION_ID } from "./partial-sync-collection-ids";
import * as schema from "./schema";

type PersonRow = InferSelectModel<typeof schema.peopleTable>;
type PersonId = PersonRow["id"];

const SEED_ROW_COUNT = 100_000;

const peopleColumnConfig = {
	columns: {
		name: { kind: "text" as const },
		age: { kind: "integer" as const },
	},
	sortableColumns: ["name", "age"] as const,
} satisfies PartialSyncTableConfig<"name" | "age">;

export class PeopleSyncDO extends QueryableDurableObject<
	PersonRow,
	typeof schema
> {
	override readonly app = this.getBaseApp()
		.get("/health", (c: Context) => c.text("ok"))
		.post(
			"/demo/randomize-visible",
			zValidator("json", demoRandomizeVisibleJsonSchema),
			async (c) => {
				const { rowIds } = c.req.valid("json");
				const ids = (rowIds ?? []).slice(0, 5);
				await this.randomizeVisiblePeopleRows(ids);
				return c.json({ ok: true as const, updated: ids.length });
			},
		);

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env, {
			schema,
			migrations,
			collectionId: PEOPLE_PARTIAL_SYNC_COLLECTION_ID,
			queryChunkSize: 200,
			seedInBackground: true,
			serializeJson: (value: unknown) => superjson.stringify(value),
			deserializeJson: (raw: string) => superjson.parse(raw),
			createPartialSyncStore: (db) => {
				const changelogHelper = createDrizzleChangelogHelper({
					db,
					changelogTable: schema.syncChangelogTable,
					serializeJson: (value: unknown) => superjson.stringify(value),
				});
				return createDrizzlePartialSyncStore({
					db,
					table: schema.peopleTable,
					columnConfig: peopleColumnConfig,
					changelogHelper,
					deserializeJson: (raw: string) => superjson.parse(raw),
					updatedAtColumnName: "updatedAt",
				});
			},
		});
	}

	async randomizeVisiblePeopleRows(rowIds: string[]): Promise<void> {
		const changes: SyncMessage<PersonRow>[] = [];
		for (const id of rowIds.slice(0, 5)) {
			const prev = await this.#getPersonRow(id);
			if (prev === undefined) continue;
			const tag = String(Math.floor(Math.random() * 10_000));
			const dash = prev.name.indexOf("-");
			const nextName =
				dash >= 0
					? `${prev.name.slice(0, dash + 1)}${tag}`
					: `${prev.name}-${tag}`;
			const next: PersonRow = {
				...prev,
				name: nextName,
				age: Math.max(
					0,
					Math.min(120, prev.age + Math.floor(Math.random() * 5) - 2),
				),
				updatedAt: new Date(),
			};
			await this.db
				.update(schema.peopleTable)
				.set({
					name: next.name,
					age: next.age,
					updatedAt: next.updatedAt,
				})
				.where(eq(schema.peopleTable.id, id as PersonId));
			const changelog = createDrizzleChangelogHelper({
				db: this.db,
				changelogTable: schema.syncChangelogTable,
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

	protected override createClientMutationSyncStore(): SyncServerBridgeStore<PersonRow> {
		const changelogHelper = createDrizzleChangelogHelper({
			db: this.db,
			changelogTable: schema.syncChangelogTable,
			serializeJson: (value: unknown) => superjson.stringify(value),
		});
		return createDrizzleMutationStore({
			db: this.db,
			table: schema.peopleTable,
			changelogHelper,
			updateColumns: ["name", "age", "updatedAt", "deletedAt"],
		});
	}

	async #getPersonRow(key: string | number): Promise<PersonRow | undefined> {
		const rows = await this.db
			.select()
			.from(schema.peopleTable)
			.where(eq(schema.peopleTable.id, String(key) as PersonId))
			.limit(1);
		return rows[0];
	}

	protected override async seedData(): Promise<void> {
		const rows = await this.db
			.select({ count: count() })
			.from(schema.peopleTable);
		const existing = rows[0]?.count ?? 0;
		if (existing >= SEED_ROW_COUNT) return;
		const ts = Date.now();
		this.db.run(sql`
			WITH RECURSIVE seq(n) AS (
				SELECT ${existing}
				UNION ALL
				SELECT n + 1 FROM seq WHERE n < ${SEED_ROW_COUNT - 1}
			)
			INSERT INTO people (id, createdAt, updatedAt, deletedAt, name, age)
			SELECT
				lower(hex(randomblob(16))),
				${ts},
				${ts},
				NULL,
				substr('abcdefghijklmnopqrstuvwxyz', 1 + ((n / 456976) % 26), 1) ||
					substr('abcdefghijklmnopqrstuvwxyz', 1 + ((n / 17576) % 26), 1) ||
					substr('abcdefghijklmnopqrstuvwxyz', 1 + ((n / 676) % 26), 1) ||
					substr('abcdefghijklmnopqrstuvwxyz', 1 + ((n / 26) % 26), 1) ||
					substr('abcdefghijklmnopqrstuvwxyz', 1 + (n % 26), 1),
				13 + (abs(random()) % 73)
			FROM seq
		`);
	}
}
