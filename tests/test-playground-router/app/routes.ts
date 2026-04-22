import {
	index,
	prefix,
	type RouteConfig,
	route,
} from "@react-router/dev/routes";

export default [
	index("routes/home.tsx"),
	...prefix("router-toolkit", [
		route("loader-test", "routes/router-toolkit/loader-test.tsx"),
		route("action-test", "routes/router-toolkit/action-test.tsx"),
		route("form-action-test", "routes/router-toolkit/form-action-test.tsx"),
		route(
			"form-action-unmount-test",
			"routes/router-toolkit/form-action-unmount-test.tsx",
		),
		route(
			"key-suffix-dual-submitter-test",
			"routes/router-toolkit/key-suffix-dual-submitter-test.tsx",
		),
		route(
			"shared-fetcher-key-dual-submitter-test",
			"routes/router-toolkit/shared-fetcher-key-dual-submitter-test.tsx",
		),
		route(
			"concurrent-submitter-test",
			"routes/router-toolkit/concurrent-submitter-test.tsx",
		),
		route(
			"plain-json-action-test",
			"routes/router-toolkit/plain-json-action-test.tsx",
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
