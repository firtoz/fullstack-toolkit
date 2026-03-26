import { env } from "cloudflare:workers";
import { honoDoFetcherWithName } from "@firtoz/hono-fetcher";
import { SqliteSyncTestDO } from "./SqliteSyncTestDO";

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
