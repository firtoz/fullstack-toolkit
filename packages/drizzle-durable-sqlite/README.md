# @firtoz/drizzle-durable-sqlite

[![npm version](https://img.shields.io/npm/v/%40firtoz%2Fdrizzle-durable-sqlite.svg)](https://www.npmjs.com/package/@firtoz/drizzle-durable-sqlite)
[![npm downloads](https://img.shields.io/npm/dm/%40firtoz%2Fdrizzle-durable-sqlite.svg)](https://www.npmjs.com/package/@firtoz/drizzle-durable-sqlite)
[![license](https://img.shields.io/npm/l/%40firtoz%2Fdrizzle-durable-sqlite.svg)](https://github.com/firtoz/fullstack-toolkit/blob/main/LICENSE)

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle-ORM-000000)](https://orm.drizzle.team/)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Durable_Objects-F38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/durable-objects/)

**Drizzle + TanStack DB on Durable Object SQLite** — same ideas as [`@firtoz/drizzle-sqlite-wasm`](../drizzle-sqlite-wasm) in the browser, but for Workers/DOs only (no React provider, no OPFS, no web workers).

## Install

```bash
bun add @firtoz/drizzle-durable-sqlite @firtoz/drizzle-utils drizzle-orm @tanstack/db
bun add -d drizzle-kit @cloudflare/workers-types
```

**Optional** (only for the [Hono + Zod example](#tanstack-db-collection-and-crud-from-a-durable-object) and a typed [`honoDoFetcher`](https://github.com/firtoz/fullstack-toolkit/tree/main/packages/hono-fetcher) client):

```bash
bun add hono zod @hono/zod-validator @firtoz/hono-fetcher
```

## Drizzle Kit (Required)

Drizzle Kit migrations are mandatory for Durable Object SQLite setups in this toolkit.
Do not skip migrations and do not rely on ad-hoc runtime table creation.

Use this exact durable-sqlite driver config so generated migrations match DO storage:

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./src/schema.ts",
	out: "./drizzle",
	dialect: "sqlite",
	driver: "durable-sqlite",
});
```

Then generate migrations:

```bash
bun run db:generate
```

`db:generate` should run `drizzle-kit generate` and write SQL files under `./drizzle`.
Keep `drizzle/migrations.js` and `drizzle/migrations.d.ts` in sync with the generated SQL files.

## Wrangler

- Import SQL as text for the migrator ([Drizzle DO docs](https://orm.drizzle.team/docs/connect-cloudflare-do)).
- Use `new_sqlite_classes` for SQLite-backed Durable Objects.

```jsonc
{
	"rules": [
		{ "type": "Text", "globs": ["**/*.sql"], "fallthrough": true }
	],
	"migrations": [{ "tag": "v1", "new_sqlite_classes": ["MyDurableObject"] }]
}
```

## Durable Object initialization (migrate first)

Run migrations in `ctx.blockConcurrencyWhile` before handling requests so schema is ready before `fetch` or alarms. Example:

```typescript
import { DurableObject } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/durable-sqlite";
import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import migrations from "../drizzle/migrations.js";
import * as schema from "./schema";

export class MyDurableObject extends DurableObject {
	private db!: ReturnType<typeof drizzle<typeof schema>>;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.ctx.blockConcurrencyWhile(async () => {
			const db = drizzle(ctx.storage, { schema });
			migrate(db, migrations);
			this.db = db;
		});
	}
}
```

[`@firtoz/chat-agent-drizzle`](../chat-agent-drizzle) uses a different pattern: `ChatAgentBase` calls a synchronous `dbInitialize()` hook (see `DrizzleChatAgent`). Use `blockConcurrencyWhile` when you are not on that agent base class.

## TanStack DB collection and CRUD from a Durable Object

Use `durableSqliteCollectionOptions` with tables built via `syncableTable` from `@firtoz/drizzle-utils` (same as WASM). The DO SQLite driver is **sync**; the shared backend uses synchronous transactions and `.all()` / `.run()` for mutations (see `@firtoz/drizzle-utils` `createSqliteTableSyncBackend` with `driverMode: "sync"`).

`tableName` must be the **property name** on your Drizzle schema object (e.g. `export const schema = { todosTable }` → `tableName: "todosTable"`), not the SQLite table name string.

If something else must finish before sync runs, pass `readyPromise`. This is not a replacement for Drizzle migrations; run `migrate(db, migrations)` first in your DO initialization.

For explicit collection type annotations, use `DrizzleSqliteTableCollection<TTable>` from `@firtoz/drizzle-utils` (same shape as WASM SQLite collections).

Example `schema.ts`:

```typescript
import { syncableTable } from "@firtoz/drizzle-utils";
import { text } from "drizzle-orm/sqlite-core";

export const todosTable = syncableTable("todos", {
	title: text("title").notNull(),
});

export const schema = { todosTable };
```

Example Durable Object: migrate in `blockConcurrencyWhile`, create the TanStack collection, then define a [Hono](https://hono.dev/) app as a **class field** (chained `.get(…)`, `.post(…)`, …) and forward `fetch` to it—the same shape as the [Durable Object snippet in `@firtoz/hono-fetcher`](../hono-fetcher/README.md).

Route handlers only run when a request is handled; Workers finish your constructor’s `blockConcurrencyWhile` work **before** the first `fetch`, so `this.todos` is always assigned before any handler runs. Pass **`this.env`** into `app.fetch` so `c.env` matches `Bindings: Env` (middleware, secrets, etc.). Use [`zValidator`](https://github.com/honojs/middleware/tree/main/packages/zod-validator) so JSON bodies and `:id` params are validated; [`honoDoFetcherWithName`](../hono-fetcher/README.md) can infer request/response types from that app without a separate exported `App` type.

For `syncMode: "on-demand"`, `await collection.preload()` inside `blockConcurrencyWhile` if you want rows loaded before serving. For `syncMode: "eager"`, you can wait for the first sync with `await new Promise<void>((resolve) => collection.onFirstReady(() => resolve()))` after `preload()`.

A minimal vitest + DO setup lives in [`tests/drizzle-durable-sqlite-test`](https://github.com/firtoz/fullstack-toolkit/tree/main/tests/drizzle-durable-sqlite-test).

```typescript
import { DurableObject } from "cloudflare:workers";
import { zValidator } from "@hono/zod-validator";
import { createCollection } from "@tanstack/db";
import type { DrizzleSqliteDODatabase } from "drizzle-orm/durable-sqlite";
import { drizzle } from "drizzle-orm/durable-sqlite";
import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import { durableSqliteCollectionOptions } from "@firtoz/drizzle-durable-sqlite";
import type { DrizzleSqliteTableCollection } from "@firtoz/drizzle-utils";
import { Hono } from "hono";
import { z } from "zod";
import migrations from "../drizzle/migrations.js";
import * as schema from "./schema";

type TodosCollection = DrizzleSqliteTableCollection<typeof schema.todosTable>;

export class TodosDurableObject extends DurableObject<Env> {
	private db!: DrizzleSqliteDODatabase<typeof schema>;
	private todos!: TodosCollection;
	app = new Hono<{ Bindings: Env }>()
		.get("/todos", (c) => c.json({ todos: this.todos.toArray }))
		.post(
			"/todos",
			zValidator("json", z.object({ title: z.string() })),
			async (c) => {
				const { title } = c.req.valid("json");
				const tx = this.todos.insert([{ title }]);
				await tx.isPersisted.promise;
				return c.json({ ok: true as const }, 201);
			},
		)
		.patch(
			"/todos/:id",
			zValidator("param", z.object({ id: z.string() })),
			zValidator(
				"json",
				z.object({ title: z.string().optional() }),
			),
			async (c) => {
				const { id } = c.req.valid("param");
				const { title } = c.req.valid("json");
				const tx = this.todos.update(id, (draft) => {
					if (title !== undefined) draft.title = title;
				});
				await tx.isPersisted.promise;
				return c.json(this.todos.state.get(id) ?? null);
			},
		)
		.delete(
			"/todos/:id",
			zValidator("param", z.object({ id: z.string() })),
			async (c) => {
				const { id } = c.req.valid("param");
				const tx = this.todos.delete([id]);
				await tx.isPersisted.promise;
				return new Response(null, { status: 204 });
			},
		)
		.notFound((c) => c.text("Not found", 404));

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);

		this.ctx.blockConcurrencyWhile(async () => {
			const db = drizzle(ctx.storage, { schema });
			migrate(db, migrations);
			this.db = db;

			const todos = createCollection(
				durableSqliteCollectionOptions({
					drizzle: db,
					tableName: "todosTable",
					syncMode: "eager",
				}),
			);
			this.todos = todos;
			todos.preload(); // Preload to ensure the data's in the collection from storage.
			await new Promise<void>((resolve) => todos.onFirstReady(() => resolve()));
		});
	}

	fetch(request: Request) {
		return this.app.fetch(request, this.env);
	}
}
```

**Typed client from your worker** (same idea as [Durable Objects in `@firtoz/hono-fetcher`](../hono-fetcher/README.md)):

```typescript
import { honoDoFetcherWithName } from "@firtoz/hono-fetcher";

const api = honoDoFetcherWithName(env.TODOS, "my-list");

await api.post({
	url: "/todos",
	body: { title: "Buy milk" },
});

const list = await api.get({ url: "/todos" });
const data = await list.json();
```

`body` / response inference follows your `zValidator` + `c.json` shapes; use `params: { id: "…" }` on `/todos/:id` routes. If inference ever fails to pick up the DO’s `app` type, pass an explicit generic, e.g. `honoDoFetcherWithName<InstanceType<typeof TodosDurableObject>["app"]>(…)`.

Adjust paths (`../drizzle/migrations.js`, `./schema`) and `Env` to match your worker. To return the created row from `POST`, read from `this.todos.state` / `toArray` after `isPersisted` and return `c.json(…)` with a shape that matches what you want the fetcher to infer.

## License

MIT
