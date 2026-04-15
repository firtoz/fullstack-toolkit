import { PUBLISHED_PACKAGES } from "./published-packages.mjs";

/** Packages that need real `cloudflare:*` resolution — run in [cf-worker-smoke](../cf-worker-smoke/). */
export const WORKERS_SMOKE_PACKAGES = [
	"@firtoz/drizzle-durable-sqlite",
	"@firtoz/websocket-do",
	"@firtoz/chat-agent",
	"@firtoz/chat-agent-sql",
	"@firtoz/chat-agent-drizzle",
];

/** React Router + peers — run in [react-router-smoke](../react-router-smoke/). */
export const REACT_ROUTER_SMOKE_PACKAGES = ["@firtoz/router-toolkit"];

const workers = new Set(WORKERS_SMOKE_PACKAGES);
const rr = new Set(REACT_ROUTER_SMOKE_PACKAGES);

/** Pure Node / no Workers or RR smoke — run in [node-smoke](../node-smoke/). */
export const NODE_SMOKE_PACKAGES = PUBLISHED_PACKAGES.filter(
	(p) => !workers.has(p) && !rr.has(p),
);
