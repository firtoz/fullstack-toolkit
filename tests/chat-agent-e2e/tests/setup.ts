import { afterAll, beforeAll, setDefaultTimeout } from "bun:test";
import type { Subprocess } from "bun";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { waitForServer } from "./common";

/**
 * Load `.env` then `.env.local` from `tests/chat-agent-e2e/` so `process.env` is set
 * before test modules run (they read `shouldSkip` at import time). Preload runs first.
 * Existing shell env wins for `.env`; `.env.local` overrides those keys.
 */
function loadEnvFromFile(filePath: string, overrideExisting: boolean): void {
	if (!existsSync(filePath)) {
		return;
	}
	const text = readFileSync(filePath, "utf-8");
	for (const line of text.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) {
			continue;
		}
		const eq = trimmed.indexOf("=");
		if (eq === -1) {
			continue;
		}
		const key = trimmed.slice(0, eq).trim();
		if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
			continue;
		}
		let value = trimmed.slice(eq + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		if (overrideExisting || process.env[key] === undefined) {
			process.env[key] = value;
		}
	}
}

const e2eRoot = join(import.meta.dir, "..");
loadEnvFromFile(join(e2eRoot, ".env"), false);
loadEnvFromFile(join(e2eRoot, ".env.local"), true);

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
