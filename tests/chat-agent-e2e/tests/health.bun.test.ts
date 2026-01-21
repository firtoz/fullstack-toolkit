import { describe, expect, test } from "bun:test";
import { HTTP_BASE_URL } from "./common";

/**
 * Basic health and environment tests for ChatAgent worker
 * Using Bun's built-in fetch and test runner
 *
 * The wrangler dev server is automatically managed by the global setup (setup.ts).
 */

// Check if environment variables are configured
const shouldSkipEnvTest = !(
	process.env.OPENROUTER_API_KEY &&
	process.env.CLOUDFLARE_ACCOUNT_ID &&
	process.env.AI_GATEWAY_NAME &&
	process.env.AI_GATEWAY_TOKEN
);

if (shouldSkipEnvTest) {
	console.warn(
		"\n⚠️  Skipping environment variable tests: Required secrets not configured.",
	);
	console.warn(
		"   Create a .env.local file with OPENROUTER_API_KEY, CLOUDFLARE_ACCOUNT_ID, AI_GATEWAY_NAME, and AI_GATEWAY_TOKEN.\n",
	);
}

describe("Worker Health (Bun)", () => {

	test("should respond to root endpoint", async () => {
		const response = await fetch(`${HTTP_BASE_URL}/`);
		expect(response.ok).toBe(true);
		expect(response.status).toBe(200);

		const text = await response.text();
		expect(text).toBe("ChatAgent E2E Test Worker");
	});

	test.skipIf(shouldSkipEnvTest)(
		"should have all required environment variables",
		async () => {
			const response = await fetch(`${HTTP_BASE_URL}/env-status`);
			expect(response.ok).toBe(true);

			const data = await response.json();
			expect(data).toMatchObject({
				hasOpenRouterKey: true,
				hasAccountId: true,
				hasGatewayName: true,
				hasGatewayToken: true,
			});
		},
	);
});
