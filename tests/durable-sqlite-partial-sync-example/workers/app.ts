import { createRequestHandler } from "react-router";

const requestHandler = createRequestHandler(
	() => import("virtual:react-router/server-build"),
	import.meta.env.MODE,
);

type Env = {
	SYNC_WORKER: Fetcher;
};

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		if (
			url.pathname.startsWith("/room/") ||
			url.pathname.startsWith("/grid/")
		) {
			return env.SYNC_WORKER.fetch(request);
		}
		return requestHandler(request, {
			cloudflare: { env, ctx },
		});
	},
} satisfies ExportedHandler<Env>;
