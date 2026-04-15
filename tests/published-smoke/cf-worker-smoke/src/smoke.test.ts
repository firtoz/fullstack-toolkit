import { describe, expect, it } from "vitest";
import { EXPECTED_EXPORTS } from "../../shared/export-expectations.mjs";

/** Keep in sync with `../../shared/groups.mjs` `WORKERS_SMOKE_PACKAGES`. */
const WORKERS_SMOKE_PACKAGES = [
	"@firtoz/drizzle-durable-sqlite",
	"@firtoz/websocket-do",
	"@firtoz/chat-agent",
	"@firtoz/chat-agent-sql",
	"@firtoz/chat-agent-drizzle",
] as const;

describe("published packages (Workers runtime)", () => {
	for (const pkg of WORKERS_SMOKE_PACKAGES) {
		it(`${pkg} loads and exports`, async () => {
			const mod = await import(pkg);
			if (!(pkg in EXPECTED_EXPORTS)) {
				throw new Error(`missing EXPECTED_EXPORTS for ${pkg}`);
			}
			const expected = EXPECTED_EXPORTS[pkg];
			for (const name of expected) {
				expect(Reflect.has(mod, name), `${pkg} missing export "${name}"`).toBe(
					true,
				);
				expect(Reflect.get(mod, name), `${pkg}.${name}`).toBeDefined();
			}
		});
	}
});
