/**
 * Minimal Worker entry so @cloudflare/vitest-pool-workers has a bundle target.
 * Tests live in smoke.test.ts.
 */
export default {
	fetch(): Response {
		return new Response("published-smoke-cf", { status: 200 });
	},
};
