#!/usr/bin/env bun
/**
 * Regenerate generated artifacts ignored by git: Wrangler `worker-configuration.d.ts`
 * and Drizzle `migrations.js` / `migrations.d.ts` / `meta/` (per package scripts).
 * Run after clone and in CI before `turbo run typecheck`.
 */
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dirname, "..");

function run(script: string, cwd: string): void {
	const full = path.join(root, cwd);
	const pkgPath = path.join(full, "package.json");
	if (!fs.existsSync(pkgPath)) {
		console.warn(`[codegen] skip missing ${cwd}`);
		return;
	}
	const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
		scripts?: Record<string, string>;
	};
	if (!pkg.scripts?.[script]) {
		console.warn(`[codegen] skip ${cwd}: no script "${script}"`);
		return;
	}
	console.log(`\n[codegen] ${cwd}: bun run ${script}`);
	const r = spawnSync("bun", ["run", script], { cwd: full, stdio: "inherit" });
	if (r.status !== 0) {
		process.exit(r.status ?? 1);
	}
}

const typegenDirs = [
	"examples/chatroom-do",
	"examples/tic-tac-toe-do",
	"tests/chat-agent-e2e",
	"tests/drizzle-durable-sqlite-test",
	"tests/durable-sqlite-partial-sync-example",
	"tests/durable-sqlite-sync-example",
	"tests/socka-do-test",
	"tests/websocket-do-test",
];

for (const dir of typegenDirs) {
	run("typegen", dir);
}

const dbJobs: Array<{ dir: string; script: string }> = [
	{ dir: "tests/drizzle-durable-sqlite-test", script: "db:generate" },
	{ dir: "tests/durable-sqlite-partial-sync-example", script: "db:generate" },
	{
		dir: "tests/durable-sqlite-partial-sync-example",
		script: "db:generate:emoji",
	},
	{ dir: "tests/durable-sqlite-sync-example", script: "db:generate" },
];

for (const { dir, script } of dbJobs) {
	run(script, dir);
}
