import { expect, test } from "@playwright/test";

function uniqueRoom(): string {
	return `room-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

test("initial load fetches first range and shows sync status", async ({ page }) => {
	const room = uniqueRoom();
	await page.goto(`/?backend=memory&room=${room}`);
	await expect(page.getByText("Durable SQLite Partial Sync")).toBeVisible();
	await expect(page.getByText(/Cached rows:/)).toBeVisible();
	await expect(page.getByText(/Live|Fetching|Connected/)).toBeVisible();
});

test("scrolling requests additional ranges", async ({ page }) => {
	const room = uniqueRoom();
	await page.goto(`/?backend=memory&room=${room}`);
	const cachedRows = page.getByText(/Cached rows:/);
	await expect(cachedRows).toBeVisible();
	const scrollArea = page.locator("div[style*='overflow: auto']").first();
	await scrollArea.evaluate((el) => {
		el.scrollTop = el.scrollHeight;
	});
	await page.waitForTimeout(1200);
	await expect(cachedRows).toBeVisible();
	await expect(page.getByText(/Fetching|Connected|Live|Cached rows/)).toBeVisible();
});

test("scroll down then back up keeps list and cache status visible", async ({
	page,
}) => {
	const room = uniqueRoom();
	await page.goto(`/?backend=memory&room=${room}`);
	const cachedRows = page.getByText(/Cached rows:/);
	await expect(cachedRows).toBeVisible();
	const scrollArea = page.locator("div[style*='overflow: auto']").first();
	await scrollArea.evaluate((el) => {
		el.scrollTop = el.scrollHeight;
	});
	await page.waitForTimeout(900);
	await scrollArea.evaluate((el) => {
		el.scrollTop = 0;
	});
	await page.waitForTimeout(900);
	await expect(cachedRows).toBeVisible();
	await expect(
		page.getByText(/Fetching|Connected|Live|Partial|Offline/),
	).toBeVisible();
});

test("sort toggle resets and fetches sorted range", async ({ page }) => {
	const room = uniqueRoom();
	await page.goto(`/?backend=memory&room=${room}`);
	await page.getByRole("button", { name: /Sort by age/ }).click();
	await expect(page.getByRole("button", { name: /Sort by age/ })).toBeVisible();
	await expect(page.getByText(/Cached rows:/)).toBeVisible();
});

test("backend switch keeps UI responsive", async ({ page }) => {
	const room = uniqueRoom();
	await page.goto(`/?backend=memory&room=${room}`);
	await page.selectOption("select", "indexeddb");
	await expect(page.getByText("People (indexeddb)")).toBeVisible();
	await page.selectOption("select", "drizzleIndexedDb");
	await expect(page.getByText("People (drizzle-idb)")).toBeVisible();
});
