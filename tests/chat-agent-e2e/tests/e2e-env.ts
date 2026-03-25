import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Env vars required for ChatAgent LLM / gateway integration tests */
export const CHAT_AGENT_E2E_REQUIRED_ENV = [
	"OPENROUTER_API_KEY",
	"CLOUDFLARE_ACCOUNT_ID",
	"AI_GATEWAY_NAME",
	"AI_GATEWAY_TOKEN",
] as const;

/** Literal placeholders from `.env.local.example` — copy-paste without editing should skip integration tests */
const PLACEHOLDER_EXACT = new Set([
	"sk-or-v1-YOUR_KEY_HERE",
	"your_cloudflare_account_id",
	"your_gateway_name",
	"your_gateway_token",
]);

/**
 * True when the value looks like a real secret, not empty and not an example placeholder.
 */
export function isConfiguredE2eEnvValue(value: string | undefined): boolean {
	if (value === undefined) {
		return false;
	}
	const v = value.trim();
	if (!v) {
		return false;
	}
	if (PLACEHOLDER_EXACT.has(v)) {
		return false;
	}
	const lower = v.toLowerCase();
	if (lower.includes("your_key_here") || lower === "changeme") {
		return false;
	}
	return true;
}

/**
 * All required vars are set to non-placeholder values (typically real CI secrets or local `.env.local`).
 */
export function isChatAgentE2eFullyConfigured(): boolean {
	return CHAT_AGENT_E2E_REQUIRED_ENV.every((key) =>
		isConfiguredE2eEnvValue(process.env[key]),
	);
}

/**
 * Load `.env` then `.env.local` from the e2e package root.
 * Never overwrites keys already present in `process.env` (shell / CI always wins over files).
 */
export function loadChatAgentE2eEnvFiles(e2eRoot: string): void {
	loadEnvFromFile(join(e2eRoot, ".env"));
	loadEnvFromFile(join(e2eRoot, ".env.local"));
}

function loadEnvFromFile(filePath: string): void {
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
		// Process / parent environment always wins; files only fill missing keys.
		if (process.env[key] === undefined) {
			process.env[key] = value;
		}
	}
}
