import { afterAll, beforeAll, setDefaultTimeout } from "bun:test";
import type { Subprocess } from "bun";
import { unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	CHAT_AGENT_E2E_REQUIRED_ENV,
	isChatAgentE2eCi,
	isChatAgentE2eFullyConfigured,
	loadChatAgentE2eEnvFiles,
} from "./e2e-env";
import { waitForServer } from "./common";

/** Double-quote so values may contain `:`, `=`, spaces, etc. (`wrangler dev --var KEY:val` breaks on `:`). */
function dotEnvQuotedLine(key: string, value: string): string {
	return `${key}="${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Load `.env` then `.env.local` from `tests/chat-agent-e2e/` before tests run (preload).
 * Skipped in CI (`CI` / `GITHUB_ACTIONS`): use workflow env only. Locally, files override shell for set keys.
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
/** CI-only: path to generated `.env.local` (removed in teardown / on failed start). */
let generatedEnvLocalPath: string | null = null;

function removeGeneratedEnvLocal(): void {
	if (generatedEnvLocalPath === null) {
		return;
	}
	try {
		unlinkSync(generatedEnvLocalPath);
	} catch {
		// ignore
	}
	generatedEnvLocalPath = null;
}

/**
 * Start the wrangler dev server
 */
async function startServer(): Promise<void> {
	if (serverStarted) {
		return;
	}

	console.log("Starting wrangler dev server...");
	const port = process.env.CHAT_AGENT_E2E_PORT ?? "8791";

	// In CI, write `.env.local`: `wrangler dev --var KEY:value` breaks when the value
	// contains `:` (common in tokens). Wrangler loads `.env` / `.env.local` from cwd automatically.
	const useCiEnvLocal = isChatAgentE2eCi() && isChatAgentE2eFullyConfigured();

	if (useCiEnvLocal) {
		const envLocalPath = join(e2eRoot, ".env.local");
		const envLocalLines = CHAT_AGENT_E2E_REQUIRED_ENV.map((key) => {
			const v = process.env[key];
			if (v === undefined || v === "") {
				return "";
			}
			return dotEnvQuotedLine(key, v);
		})
			.filter(Boolean)
			.join("\n");
		const body = `${envLocalLines}\n`;
		writeFileSync(envLocalPath, body, "utf-8");
		generatedEnvLocalPath = envLocalPath;
	}

	// Local dev: pass vars via `--var` from process.env (after e2e-env file load), or rely on
	// `.env.local` on disk — wrangler reads those files automatically when present.
	const wranglerArgs = ["run", "wrangler", "dev", "--local", "--port", port];

	if (!useCiEnvLocal) {
		if (process.env.OPENROUTER_API_KEY) {
			wranglerArgs.push(
				"--var",
				`OPENROUTER_API_KEY:${process.env.OPENROUTER_API_KEY}`,
			);
		}
		if (process.env.CLOUDFLARE_ACCOUNT_ID) {
			wranglerArgs.push(
				"--var",
				`CLOUDFLARE_ACCOUNT_ID:${process.env.CLOUDFLARE_ACCOUNT_ID}`,
			);
		}
		if (process.env.AI_GATEWAY_NAME) {
			wranglerArgs.push(
				"--var",
				`AI_GATEWAY_NAME:${process.env.AI_GATEWAY_NAME}`,
			);
		}
		if (process.env.AI_GATEWAY_TOKEN) {
			wranglerArgs.push(
				"--var",
				`AI_GATEWAY_TOKEN:${process.env.AI_GATEWAY_TOKEN}`,
			);
		}
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
		removeGeneratedEnvLocal();
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
	removeGeneratedEnvLocal();
}

// Global setup - runs once before all tests
beforeAll(async () => {
	await startServer();
}, 60000); // 60 second timeout for server startup

// Global teardown - runs once after all tests
afterAll(() => {
	stopServer();
});
