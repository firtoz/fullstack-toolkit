/* eslint-disable */
declare namespace Cloudflare {
	interface Env {
		PEOPLE_SYNC: DurableObjectNamespace<import("./src/PeopleSyncDO").PeopleSyncDO>;
		SYNC_WORKER: Fetcher;
	}
}

interface Env extends Cloudflare.Env {}
