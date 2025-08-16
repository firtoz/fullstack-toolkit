import { index, type RouteConfig, route } from "@react-router/dev/routes";

export default [
	index("routes/home.tsx"),
	route("loader-test", "routes/loader-test.tsx"),
	route("action-test", "routes/action-test.tsx"),
	route("form-action-test", "routes/form-action-test.tsx"),
	route("combined-test", "routes/combined-test.tsx"),
] satisfies RouteConfig;
