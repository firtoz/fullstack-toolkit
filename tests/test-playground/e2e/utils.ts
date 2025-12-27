import type { Page } from "@playwright/test";

// Helper to wait for query to be ready
export async function waitForQueryReady(page: Page) {
	await page.waitForSelector('[data-testid="query-status"]:has-text("Ready")', {
		timeout: 10000,
	});
}
export async function waitForDBReady(page: Page) {
	await page.waitForSelector('[data-testid="db-status"]:has-text("ready")', {
		timeout: 30000,
	});
} // Helper to wait for SQLite worker to be ready
export async function waitForWorkerReady(page: Page) {
	await page.waitForSelector(
		'[data-testid="worker-status"]:has-text("ready")',
		{
			timeout: 30000,
		},
	);
}
