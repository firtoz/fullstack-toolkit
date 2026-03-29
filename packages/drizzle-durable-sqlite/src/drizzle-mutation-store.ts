import type { SyncServerBridgeStore } from "@firtoz/collection-sync";
import type { SyncMessage } from "@firtoz/db-helpers";
import { exhaustiveGuard } from "@firtoz/maybe-error";
import { eq, getTableColumns } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import type { DrizzleChangelogHelper } from "./drizzle-partial-sync-changelog";
import type { PartialSyncSqliteDatabase } from "./partial-sync-sqlite-db";

export type CreateDrizzleMutationStoreOptions<
	TSchema extends Record<string, unknown>,
	TRow extends { id: string | number },
> = {
	db: PartialSyncSqliteDatabase<TSchema>;
	table: SQLiteTable;
	changelogHelper: DrizzleChangelogHelper<TSchema>;
	/** Columns to copy from `update` message.value into SET (excluding id). */
	updateColumns: readonly (keyof TRow & string)[];
};

export function createDrizzleMutationStore<
	TSchema extends Record<string, unknown>,
	TRow extends { id: string | number },
>(
	options: CreateDrizzleMutationStoreOptions<TSchema, TRow>,
): SyncServerBridgeStore<TRow> {
	const { db, table, changelogHelper, updateColumns } = options;
	const tableColumns = getTableColumns(table);
	const idCol = tableColumns.id;
	if (idCol === undefined) {
		throw new Error("Mutation table must have an id column");
	}

	return {
		applySyncMessages: async (messages: SyncMessage<TRow>[]) => {
			for (const message of messages) {
				switch (message.type) {
					case "insert":
						await db
							.insert(table)
							.values(message.value as Record<string, unknown>);
						await changelogHelper.append(
							"insert",
							String(message.value.id),
							message.value,
						);
						break;
					case "update": {
						const setPayload: Record<string, unknown> = {};
						const v = message.value as Record<string, unknown>;
						for (const col of updateColumns) {
							setPayload[col] = v[col];
						}
						await db
							.update(table)
							.set(setPayload as never)
							.where(eq(idCol, message.value.id as never));
						await changelogHelper.append("update", String(message.value.id), {
							value: message.value,
							previousValue: message.previousValue,
						});
						break;
					}
					case "delete": {
						const existing = await db
							.select()
							.from(table)
							.where(eq(idCol, message.key as never))
							.limit(1);
						const prev = existing[0];
						await db.delete(table).where(eq(idCol, message.key as never));
						await changelogHelper.append(
							"delete",
							String(message.key),
							prev ?? null,
						);
						break;
					}
					case "truncate":
						await changelogHelper.deleteAll();
						await db.delete(table);
						break;
					default:
						exhaustiveGuard(message);
				}
			}
		},

		getSnapshotMessages: async () => {
			const rows = await db.select().from(table);
			return rows.map((row) => ({
				type: "insert" as const,
				value: row as TRow,
			}));
		},

		getRow: async (key: string | number) => {
			const rows = await db
				.select()
				.from(table)
				.where(eq(idCol, key as never))
				.limit(1);
			return rows[0] as TRow | undefined;
		},
	};
}
