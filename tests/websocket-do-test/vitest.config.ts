/**
 * Vitest configuration for testing Cloudflare Workers with Durable Objects
 *
 * Uses @cloudflare/vitest-pool-workers which provides:
 * - Full WebSocket support (unlike unstable_dev)
 * - Miniflare-based environment that closely matches production
 * - Proper Durable Object binding resolution
 *
 * Reference: https://developers.cloudflare.com/workers/testing/vitest-integration/configuration/
 */

import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: {
				configPath: "./wrangler.jsonc",
			},
		}),
	],
	test: {
		include: ["src/websocket/**/*.test.ts"],
		testTimeout: 30000,
		hookTimeout: 30000,
	},
});
