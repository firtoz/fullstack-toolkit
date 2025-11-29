import type { RegisterPages } from "./RegisterPages";

// Helper types matching React Router's internal implementation
type Equal<X, Y> =
	(<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
		? true
		: false;

type ToArgs<Params extends Record<string, string | undefined>> =
	Equal<
		Params,
		// biome-ignore lint/complexity/noBannedTypes: This is intentionally empty.
		{}
	> extends true
		? []
		: Partial<Params> extends Params
			? [Params] | []
			: [Params];

// Matches React Router's Args type structure
export type HrefArgs<T extends keyof RegisterPages> = ToArgs<
	RegisterPages[T]["params"]
>;
