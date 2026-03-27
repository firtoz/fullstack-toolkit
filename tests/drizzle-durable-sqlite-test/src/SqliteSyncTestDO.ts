import { DurableObject } from "cloudflare:workers";
import { durableSqliteCollectionOptions } from "@firtoz/drizzle-durable-sqlite";
import type { DrizzleSqliteTableCollection } from "@firtoz/drizzle-utils";
import { zValidator } from "@hono/zod-validator";
import { createCollection } from "@tanstack/db";
import type { DrizzleSqliteDODatabase } from "drizzle-orm/durable-sqlite";
import { drizzle } from "drizzle-orm/durable-sqlite";
import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import { Hono } from "hono";
import { z } from "zod";
import migrations from "../drizzle/migrations.js";
import * as schema from "./schema";

type InsertTestItem = (typeof schema.testItemsTable)["$inferInsert"];

/**
 * Minimal DO used only by vitest-pool-workers: SQLite + Drizzle migrate + durableSqliteCollectionOptions insert path.
 */
export class SqliteSyncTestDO extends DurableObject<Env> {
	private db!: DrizzleSqliteDODatabase<typeof schema>;
	private collection!: DrizzleSqliteTableCollection<typeof schema.testItemsTable>;
	app = new Hono<{ Bindings: Env }>()
		.post(
			"/insert-via-collection",
			zValidator(
				"json",
				z.object({
					title: z.string(),
				}),
			),
			async (c) => {
				const body = c.req.valid("json");

				const item: InsertTestItem = {
					title: body.title,
				};

				const tx = this.collection.insert(item);
				await tx.isPersisted.promise;

				const rows = this.collection.toArray;
				return c.json({
					count: rows.length,
					lastTitle: rows[rows.length - 1]?.title ?? null,
					lastId: rows[rows.length - 1]?.id ?? null,
				});
			},
		)
		.get((c) => {
			return c.text("SqliteSyncTestDO", {
				status: 404,
			});
		});

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);

		this.ctx.blockConcurrencyWhile(async () => {
			const db = drizzle(ctx.storage, { schema });
			migrate(db, migrations);
			this.db = db;

			this.collection = this.getCollection();
			await this.collection.preload();
		});
	}

	private getCollection = () => {
		const collection = createCollection(
			durableSqliteCollectionOptions({
				drizzle: this.db,
				tableName: "testItemsTable",
				syncMode: "on-demand",
			}),
		);

		return collection;
	};

	async fetch(request: Request): Promise<Response> {
		return this.app.fetch(request, this.env);
	}
}
