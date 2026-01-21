import type init from "@sqlite.org/sqlite-wasm";

export type Sqlite3Static = Awaited<ReturnType<typeof init>>;
export type Database = InstanceType<Sqlite3Static["oo1"]["DB"]>;
