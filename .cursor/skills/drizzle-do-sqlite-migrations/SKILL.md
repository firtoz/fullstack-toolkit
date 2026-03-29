# Drizzle DO SQLite Migrations

Use this skill when working with Cloudflare Durable Object SQLite + Drizzle in this monorepo.

## Non-negotiable rules

1. Always use Drizzle Kit migrations.
2. Always use `driver: "durable-sqlite"` in `drizzle.config.ts`.
3. Always run `migrate(db, migrations)` in `ctx.blockConcurrencyWhile(...)` before serving requests.
4. Always configure Wrangler SQL import rules so `.sql` files are bundled.

## Required project layout

- `drizzle.config.ts`
- `drizzle/<migration>.sql`
- `drizzle/meta/_journal.json`
- `drizzle/migrations.js`
- `drizzle/migrations.d.ts`

## Required config

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./src/schema.ts",
	out: "./drizzle",
	dialect: "sqlite",
	driver: "durable-sqlite",
});
```

## Wrangler requirements

```jsonc
{
	"rules": [{ "type": "Text", "globs": ["**/*.sql"], "fallthrough": true }],
	"migrations": [{ "tag": "v1", "new_sqlite_classes": ["MyDurableObject"] }]
}
```

## DO initialization template

```ts
this.ctx.blockConcurrencyWhile(async () => {
	const db = drizzle(ctx.storage, { schema });
	migrate(db, migrations);
	// initialize collections after migrate
});
```

## Workflow

1. Update schema.
2. Run `bun run db:generate` (`drizzle-kit generate`).
3. Update `drizzle/migrations.js` export map for new SQL files.
4. Ensure `drizzle/migrations.d.ts` exists.
5. Run typecheck/tests.
