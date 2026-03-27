import type { CollectionUtils } from "@firtoz/db-helpers";
import type {
	Collection,
	InferSchemaInput,
	InferSchemaOutput,
} from "@tanstack/db";
import type { IdOf, InsertToSelectSchema, SelectSchema } from "./collection-utils";
import type { TableWithRequiredFields } from "./syncableTable";

/**
 * TanStack {@link Collection} for a syncable Drizzle SQLite table (`syncableTable` columns).
 *
 * Shared by `@firtoz/drizzle-sqlite-wasm` (async driver) and `@firtoz/drizzle-durable-sqlite`
 * (Durable Object sync driver). Import this type from `@firtoz/drizzle-utils` rather than
 * duplicating it per package.
 */
export type DrizzleSqliteTableCollection<TTable extends TableWithRequiredFields> =
	Collection<
		InferSchemaOutput<SelectSchema<TTable>>,
		IdOf<TTable>,
		CollectionUtils<InferSchemaOutput<SelectSchema<TTable>>>,
		InsertToSelectSchema<TTable>,
		InferSchemaInput<InsertToSelectSchema<TTable>>
	>;
