import {
	index,
	prefix,
	type RouteConfig,
	route,
} from "@react-router/dev/routes";

export default [
	index("routes/home.tsx"),
	route("api/clear-opfs", "routes/api/clear-opfs.tsx"),
	...prefix("collections", [
		route("sqlite-test", "routes/collections/sqlite-test.tsx"),
		route("indexeddb-test", "routes/collections/indexeddb-test.tsx"),
		route(
			"indexeddb-migration-test",
			"routes/collections/indexeddb-migration-test.tsx",
		),
		route("sync-mode-test", "routes/collections/sync-mode-test.tsx"),
		route(
			"sqlite-sync-mode-test",
			"routes/collections/sqlite-sync-mode-test.tsx",
		),
		route("standalone-test", "routes/collections/standalone-test.tsx"),
		route(
			"memory-collection-test",
			"routes/collections/memory-collection-test.tsx",
		),
		route(
			"memory-collection-n-sync-test",
			"routes/collections/memory-collection-n-sync-test.tsx",
		),
		route(
			"keyval-collection-test",
			"routes/collections/keyval-collection-test.tsx",
		),
		route("pagination-test", "routes/collections/pagination-test.tsx"),
		route(
			"sqlite-pagination-test",
			"routes/collections/sqlite-pagination-test.tsx",
		),
		route(
			"tanstack-06-virtual-props-demo",
			"routes/collections/tanstack-06-virtual-props-demo.tsx",
		),
	]),
	...prefix("router-toolkit", [
		route("loader-test", "routes/router-toolkit/loader-test.tsx"),
		route("action-test", "routes/router-toolkit/action-test.tsx"),
		route("form-action-test", "routes/router-toolkit/form-action-test.tsx"),
		route(
			"concurrent-submitter-test",
			"routes/router-toolkit/concurrent-submitter-test.tsx",
		),
		route(
			"submitter-with-loader",
			"routes/router-toolkit/submitter-with-loader.tsx",
		),
		route(
			"fetcher-data-refresh",
			"routes/router-toolkit/fetcher-data-refresh.tsx",
		),
		route(
			"fetcher-invalidation",
			"routes/router-toolkit/fetcher-invalidation.tsx",
		),
	]),
] satisfies RouteConfig;
