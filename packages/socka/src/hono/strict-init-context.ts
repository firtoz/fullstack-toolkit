import type { Context } from "hono";
import type { SockaStrictWebSocketInit } from "../server/SockaWebSocketSession";

/**
 * Build {@link SockaStrictWebSocketInit} from a Hono {@link Context} by synthesizing a
 * **`Request`** from **`c.req.url`** (method GET; URL matches the incoming upgrade).
 *
 * Used when **`sockaHonoNodeWs` / `sockaHonoCloudflare`** omit a custom **`sockaInit`** and
 * **`strictUpgradeRequest: true`** is set: **`createData`** then always receives
 * **`init.request`** without you writing **`sockaInit: (ctx) => ({ request: new Request(ctx.req.url) })`** by hand.
 *
 * For full fidelity to the original upgrade (headers, method), pass your own **`sockaInit`**
 * that forwards the real **`Request`** from your runtime instead of this helper.
 */
export function sockaHonoStrictInitFromContext(
	c: Context,
): SockaStrictWebSocketInit {
	return { request: new Request(c.req.url) };
}
