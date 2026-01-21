import { beforeAll, afterAll } from "bun:test";
import type { Subprocess } from "bun";
import { waitForServer } from "./common";

/**
 * Global test setup for ChatAgent E2E tests
 * 
 * This file is loaded via bunfig.toml preload and should NOT be imported by test files.
 * It manages a single wrangler dev server instance shared across all test files.
 * 
 * The server starts once before any tests run and stops after all tests complete.
 */

let wranglerProcess: Subprocess | null = null;
let serverStarted = false;

/**
 * Start the wrangler dev server
 */
async function startServer(): Promise<void> {
	if (serverStarted) {
		return;
	}

	console.log("Starting wrangler dev server...");

	wranglerProcess = Bun.spawn(["bun", "run", "dev"], {
		cwd: `${import.meta.dir}/..`,
		stdout: "pipe",
		stderr: "pipe",
	});

	const ready = await waitForServer();
	if (!ready) {
		wranglerProcess.kill();
		throw new Error("Server failed to start within 15 seconds");
	}

	console.log("✓ Server ready");
	serverStarted = true;
}

/**
 * Stop the wrangler dev server
 */
function stopServer(): void {
	if (wranglerProcess && serverStarted) {
		console.log("Stopping wrangler dev server...");
		wranglerProcess.kill();
		wranglerProcess = null;
		serverStarted = false;
	}
}

// Global setup - runs once before all tests
beforeAll(async () => {
	await startServer();
});

// Global teardown - runs once after all tests
afterAll(() => {
	stopServer();
});
