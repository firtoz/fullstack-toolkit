import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
	index("routes/index.tsx"),
	route("sync-todos", "routes/home.tsx"),
	route("virtual-props-do", "routes/virtual-props-do.tsx"),
	route("virtual-props-do-ws", "routes/virtual-props-do-ws.tsx"),
] satisfies RouteConfig;
