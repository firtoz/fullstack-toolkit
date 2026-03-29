import { openIndexedDb } from "@firtoz/drizzle-indexeddb";
import type { IDBDatabaseLike } from "@firtoz/drizzle-indexeddb";

/** Drizzle + IndexedDB backing store for the emoji grid partial-sync demo (separate from keyval IDB). */
export function openDrizzleEmojiGridIdb(
	roomId: string,
): Promise<IDBDatabaseLike> {
	return openIndexedDb(`drizzle-partial-emoji-${roomId}`, undefined, {
		version: 1,
		onUpgrade: (db) => {
			if (!db.hasStore("emoji_grid")) {
				db.createStore("emoji_grid", { keyPath: "id" });
			}
			try {
				db.createIndex("emoji_grid", "emoji_grid_x_y_idx", ["x", "y"], {});
			} catch {
				// Index already present on re-upgrade.
			}
		},
	});
}

/** Drizzle + IndexedDB backing store for the people partial-sync demo. */
export function openDrizzlePeoplePartialSyncIdb(
	roomId: string,
): Promise<IDBDatabaseLike> {
	return openIndexedDb(`drizzle-partial-people-${roomId}`, undefined, {
		version: 1,
		onUpgrade: (db) => {
			if (!db.hasStore("people")) {
				db.createStore("people", { keyPath: "id" });
			}
			try {
				db.createIndex("people", "people_age_idx", "age", {});
			} catch {
				// Index already present on re-upgrade.
			}
		},
	});
}
