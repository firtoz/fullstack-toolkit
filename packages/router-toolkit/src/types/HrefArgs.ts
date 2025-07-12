import type { href } from "react-router";
import type { RegisterPages } from "./RegisterPages";

export type HrefArgs<T extends keyof RegisterPages> = Parameters<
	typeof href<T>
> extends [string, ...infer Rest]
	? Rest
	: [];
