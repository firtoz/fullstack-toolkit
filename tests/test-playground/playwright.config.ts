import { defineConfig, devices } from "@playwright/test";

const testPlaygroundPort = process.env.TEST_PLAYGROUND_PORT ?? "5174";
const testPlaygroundHost = "127.0.0.1";
const testPlaygroundBaseUrl = `http://${testPlaygroundHost}:${testPlaygroundPort}`;

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	// Multiple workers share one origin: global OPFS clear and IndexedDB would race
	// without per-worker DB names. SQLite tests still clear all OPFS, so stay serial.
	workers: 1,
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
