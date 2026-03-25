import { afterAll, beforeAll, setDefaultTimeout } from "bun:test";
import type { Subprocess } from "bun";
import { join } from "node:path";
import { loadChatAgentE2eEnvFiles } from "./e2e-env";
import { waitForServer } from "./common";

/**
 * Load `.env` then `.env.local` from `tests/chat-agent-e2e/` so `process.env` is set
 * before test modules run (they read `shouldSkip` at import time). Preload runs first.
 * Existing `process.env` (shell / CI) is never overwritten by files; files only fill missing keys.
 */
const e2eRoot = join(import.meta.dir, "..");
loadChatAgentE2eEnvFiles(e2eRoot);

/** Default per-test timeout (LLM + tool rounds can exceed Bun’s 5s default). */
setDefaultTimeout(120_000);

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

	// Build wrangler command with --var flags for env vars  
	const wranglerArgs = ["run", "wrangler", "dev", "--local"];
	
	if (process.env.OPENROUTER_API_KEY) {
		wranglerArgs.push("--var", `OPENROUTER_API_KEY:${process.env.OPENROUTER_API_KEY}`);
	}
	if (process.env.CLOUDFLARE_ACCOUNT_ID) {
		wranglerArgs.push("--var", `CLOUDFLARE_ACCOUNT_ID:${process.env.CLOUDFLARE_ACCOUNT_ID}`);
	}
	if (process.env.AI_GATEWAY_NAME) {
		wranglerArgs.push("--var", `AI_GATEWAY_NAME:${process.env.AI_GATEWAY_NAME}`);
	}
	if (process.env.AI_GATEWAY_TOKEN) {
		wranglerArgs.push("--var", `AI_GATEWAY_TOKEN:${process.env.AI_GATEWAY_TOKEN}`);
	}

	wranglerProcess = Bun.spawn(["bun", ...wranglerArgs], {
		cwd: `${import.meta.dir}/..`,
		stdout: "inherit",
		stderr: "inherit",
		env: {
			...process.env,
		},
	});

	const ready = await waitForServer();
	if (!ready) {
		wranglerProcess.kill();
		throw new Error("Server failed to start within 30 seconds");
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
}, 60000); // 60 second timeout for server startup

// Global teardown - runs once after all tests
afterAll(() => {
	stopServer();
});
