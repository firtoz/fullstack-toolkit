import type { Func } from "./Func";
import type { RegisterPages } from "./RegisterPages";

export type RouteWithLoaderModule = {
	route: keyof RegisterPages;
	loader: Func;
};
