import {
	type DrizzleSqliteDODatabase,
	drizzle,
} from "drizzle-orm/durable-sqlite";
import * as schema from "./schema";

export * from "./schema";

/**
 * Creates a Drizzle instance for Durable Object SQLite storage
 * Uses the native drizzle-orm/durable-sqlite driver
 *
 * @see https://orm.drizzle.team/docs/connect-cloudflare-do
 */
export function createDb(
	storage: DurableObjectStorage,
): DrizzleSqliteDODatabase<typeof schema> {
	return drizzle(storage, { schema, logger: false });
}

export type Database = DrizzleSqliteDODatabase<typeof schema>;
