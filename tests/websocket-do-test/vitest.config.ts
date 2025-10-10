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

import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
	test: {
		// Timeouts for async operations like WebSocket connections and message broadcasting
		testTimeout: 30000,
		hookTimeout: 30000,

		poolOptions: {
			workers: {
				wrangler: {
					// Point to wrangler config to get DO bindings, environment, etc.
					// This automatically loads your Durable Object classes and bindings
					// Reference: https://developers.cloudflare.com/workers/testing/vitest-integration/get-started/
					configPath: "./wrangler.jsonc",
				},
			},
		},
	},
});
