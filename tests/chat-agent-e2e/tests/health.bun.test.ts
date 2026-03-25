import { describe, expect, test } from "bun:test";
import { HTTP_BASE_URL } from "./common";
import { isChatAgentE2eFullyConfigured } from "./e2e-env";

/**
 * Basic health and environment tests for ChatAgent worker
 * Using Bun's built-in fetch and test runner
 *
 * The wrangler dev server is automatically managed by the global setup (setup.ts).
 */

const shouldSkipEnvTest = !isChatAgentE2eFullyConfigured();

if (shouldSkipEnvTest) {
	console.warn(
		"\n⚠️  Skipping environment variable tests: required secrets missing or still example placeholders.",
	);
	console.warn(
		"   Set the variables in the environment or in tests/chat-agent-e2e/.env.local; existing process env is never overwritten by files.\n",
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
