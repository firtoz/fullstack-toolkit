import type { Page } from "@playwright/test";

/**
 * Navigate with `domcontentloaded` + a generous timeout. Full `load` / default
 * waits are flaky against Vite dev (HMR, long‑lived connections) and can surface
 * as `net::ERR_ABORTED` when the dev server is busy under parallel workers.
 */
export async function gotoReady(page: Page, url: string): Promise<void> {
	await page.goto(url, {
		waitUntil: "domcontentloaded",
		timeout: 60_000,
	});
}

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
