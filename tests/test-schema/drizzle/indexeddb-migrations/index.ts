import { migrate_0000 } from './0000_luxuriant_power_pack';
import { migrate_0001 } from './0001_purple_inhumans';

export type IndexedDBMigrationFunction = (
	db: IDBDatabase,
) => Promise<void>;

export const migrations: IndexedDBMigrationFunction[] = [
	migrate_0000,
	migrate_0001
];

export default migrations;
