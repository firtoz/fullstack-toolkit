import { expect, test } from "@playwright/test";
import {
	clearOpfsRootEntriesWithPrefix,
	opfsSqliteFilePrefix,
	sqlitePlaygroundDbNameForE2e,
} from "test-playground-shared/e2e-worker-db";

function sqliteTestUrl(
	e2eWorker: number,
	checkpoint: "true" | "false" = "true",
): string {
	return `/collections/sqlite-test?checkpoint=${checkpoint}&e2eWorker=${e2eWorker}`;
}

test.describe("SQLite session — ready gate and DB switch", () => {
	test("shows loading then ready main content (sqlite-test)", async ({
		page,
	}, testInfo) => {
		const db = sqlitePlaygroundDbNameForE2e(testInfo);
		await page.goto("/");
		await clearOpfsRootEntriesWithPrefix(
			page,
			opfsSqliteFilePrefix(db),
		);
		const url = sqliteTestUrl(testInfo.parallelIndex, "true");
		await page.goto(url);
		await page.waitForLoadState("networkidle");

		// Not-ready UI may be too brief to assert visibility; `hidden` also passes if the node was never mounted.
		const loading = page.getByTestId("sqlite-db-loading");
		try {
			await expect(loading).toBeVisible({ timeout: 2000 });
		} catch {
			// fast path: worker + migrations completed before we observed loading
		}
		await loading.waitFor({ state: "hidden", timeout: 20_000 });
		await expect(page.getByTestId("count-total")).toBeVisible({
			timeout: 20_000,
		});
	});

	test("e2eWorker 0 vs 1: data isolated when switching on same route", async ({
		page,
	}, testInfo) => {
		const w0 = testInfo.parallelIndex * 2;
		const w1 = testInfo.parallelIndex * 2 + 1;
		const db0 = `test-w${w0}.db`;
		const db1 = `test-w${w1}.db`;

		await page.goto("/");
		await clearOpfsRootEntriesWithPrefix(page, opfsSqliteFilePrefix(db0));
		await clearOpfsRootEntriesWithPrefix(page, opfsSqliteFilePrefix(db1));

		await page.goto(sqliteTestUrl(w0, "true"));
		await page.waitForLoadState("networkidle");
		await expect(page.getByTestId("count-total")).toBeVisible({ timeout: 20_000 });

		const input = page.getByTestId("todo-input");
		const addButton = page.getByTestId("add-task-button");
		await input.fill("OnlyOnWorkerZero");
		await addButton.click();
		const firstTitle = page.locator("[data-testid^='todo-title-']").first();
		await expect(firstTitle).toBeVisible({ timeout: 10_000 });
		await expect(firstTitle).toHaveValue("OnlyOnWorkerZero");

		await page.goto(sqliteTestUrl(w1, "true"));
		await page.waitForLoadState("networkidle");
		await expect(page.getByTestId("count-total")).toBeVisible({ timeout: 20_000 });
		await expect(page.locator("[data-testid^='todo-title-']")).toHaveCount(0);

		await page.goto(sqliteTestUrl(w0, "true"));
		await page.waitForLoadState("networkidle");
		await expect(page.getByTestId("count-total")).toBeVisible({ timeout: 20_000 });
		await expect(
			page.locator("[data-testid^='todo-title-']").first(),
		).toHaveValue("OnlyOnWorkerZero");
	});
});
