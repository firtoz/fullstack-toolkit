import { defineConfig, devices } from "@playwright/test";

const testPlaygroundPort = process.env.TEST_PLAYGROUND_PORT ?? "5174";
const testPlaygroundHost = "127.0.0.1";
const testPlaygroundBaseUrl = `http://${testPlaygroundHost}:${testPlaygroundPort}`;

export default defineConfig({
	testDir: "./e2e",
	// Serial within each file avoids races on shared DB names (e.g. migration tests);
	// multiple spec files still run in parallel across workers.
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	// Parallel workers share one origin: DB names and OPFS clears are scoped per
	// Playwright worker via `e2eWorker` / `parallelIndex` (see e2e-worker-db.ts).
	workers: process.env.CI ? 4 : undefined,
	reporter: [["list"], ["html", { open: "never" }]],
	use: {
		baseURL: testPlaygroundBaseUrl,
		trace: "on-first-retry",
		video: "retain-on-failure",
	},

	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],

	webServer: {
		command: `react-router dev --port ${testPlaygroundPort} --host ${testPlaygroundHost}`,
		url: testPlaygroundBaseUrl,
		timeout: 120_000,
		reuseExistingServer: !process.env.CI,
	},
});
