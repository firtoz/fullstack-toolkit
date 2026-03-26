/**
 * Integration test: Durable Object SQLite + durableSqliteCollectionOptions insert path.
 */

import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import "./worker";

describe("drizzle-durable-sqlite DO integration", () => {
	it("inserts via durableSqliteCollectionOptions (sync transaction backend)", async () => {
		const resp = await exports.default.fetch("http://example.com/");
		expect(resp.status).toBe(200);

		type Data = Awaited<
			ReturnType<
				Awaited<ReturnType<typeof import("./worker").default["fetch"]>>["json"]
			>
		>;

		const data = await resp.json<Data>();

		expect(data.count).toBeGreaterThanOrEqual(1);
		expect(data.lastTitle).toBe("from-collection");
		expect(data.lastId).toBeDefined();
	});
});
