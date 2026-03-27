import { SyncableDurableObject } from "@firtoz/drizzle-durable-sqlite";
import superjson from "superjson";
import migrations from "../drizzle/migrations.js";
import * as schema from "./schema";

export class TodoSyncDO extends SyncableDurableObject<typeof schema, "todosTable"> {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env, {
			schema,
			tableName: "todosTable",
			migrations,
			serializeJson: (value: unknown) => superjson.stringify(value),
			deserializeJson: (raw: string) => superjson.parse(raw),
		});
	}
}
