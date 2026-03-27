import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./e2e",
	use: {
		baseURL: "http://127.0.0.1:5199",
		trace: "on-first-retry",
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
	webServer: {
		command: "bun run dev",
		url: "http://127.0.0.1:5199",
		timeout: 120_000,
		reuseExistingServer: true,
	},
});
