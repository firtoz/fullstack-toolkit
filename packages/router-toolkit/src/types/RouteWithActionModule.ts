import type { Func } from "./Func";
import type { RegisterPages } from "./RegisterPages";
import type { z } from "zod";

/**
 * Route module shape for type-safe form actions: route path, action handler, and form schema.
 * Use with useDynamicSubmitter and useConcurrentSubmitter.
 */
export type RouteWithActionModule = {
	route: keyof RegisterPages;
	action: Func;
	formSchema: z.ZodType;
};

/** Action result type inferred from the route module's action */
export type ActionResult<TModule extends RouteWithActionModule> = Awaited<
	ReturnType<TModule["action"]>
>;
