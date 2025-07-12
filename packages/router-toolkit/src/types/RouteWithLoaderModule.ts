import type { Func } from "./Func";
import type { RegisterPages } from "./RegisterPages";

export type RouteWithLoaderModule = {
	file: keyof RegisterPages;
	loader: Func;
};
