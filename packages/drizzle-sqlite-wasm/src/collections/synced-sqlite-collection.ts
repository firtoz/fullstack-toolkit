import {
	createSyncedCollection,
	type SyncableCollectionItem,
	type SyncClientBridge,
	type SyncClientMessage,
	type WithSyncOptions,
} from "@firtoz/collection-sync";
import type { Collection } from "@tanstack/db";
import type { TableWithRequiredFields } from "@firtoz/drizzle-utils";
import type { InferSelectModel } from "drizzle-orm";
import type {
	AnyDrizzleDatabase,
	DrizzleSchema,
	DrizzleSqliteCollectionConfig,
	ValidTableNames,
} from "./sqlite-collection";
import { sqliteCollectionOptions } from "./sqlite-collection";

/**
 * Like {@link createSyncedCollection} from `@firtoz/collection-sync`, but row type uses Drizzle’s
 * {@link InferSelectModel} so branded columns (e.g. ids) match `$inferSelect`, not Valibot schema output.
 */
export function createSyncedSqliteCollection<
	const TDrizzle extends AnyDrizzleDatabase,
	const TTableName extends string & ValidTableNames<DrizzleSchema<TDrizzle>>,
	TTable extends DrizzleSchema<TDrizzle>[TTableName] & TableWithRequiredFields,
>(
	config: DrizzleSqliteCollectionConfig<TDrizzle, TTableName>,
	syncOptions?: WithSyncOptions,
): {
	collection: Collection<InferSelectModel<TTable>>;
	bridge: SyncClientBridge<InferSelectModel<TTable> & SyncableCollectionItem>;
	setTransportSend: (send: (msg: SyncClientMessage) => void) => void;
} {
	type TRow = InferSelectModel<TTable>;
	type TBridgeItem = TRow & SyncableCollectionItem;
	const options = sqliteCollectionOptions(config);
	const { collection, bridge, setTransportSend } = createSyncedCollection(
		options,
		syncOptions,
	);
	return {
		collection: collection as unknown as Collection<TRow>,
		bridge: bridge as unknown as SyncClientBridge<TBridgeItem>,
		setTransportSend,
	};
}
