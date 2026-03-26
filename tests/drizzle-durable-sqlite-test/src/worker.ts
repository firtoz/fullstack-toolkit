import { env } from "cloudflare:workers";
import { SqliteSyncTestDO } from "./SqliteSyncTestDO";
import { honoDoFetcherWithName } from "@firtoz/hono-fetcher";

export default {
	async fetch() {
		const fetcher = honoDoFetcherWithName(env.SQLITE_SYNC_TEST, "singleton");

		return fetcher.post({
			url: "/insert-via-collection",
			body: { title: "from-collection" },
		});
	},
} satisfies ExportedHandler<Env>;

export { SqliteSyncTestDO };
