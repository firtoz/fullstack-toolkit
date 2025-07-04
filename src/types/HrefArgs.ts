import type { href, Register } from "react-router";

type AnyParams = Record<string, string | undefined>;
type AnyPages = Record<string, {
	params: AnyParams;
}>;

export type RegisterPages = Register extends {
	pages: infer Registered extends AnyPages;
} ? Registered : AnyPages;

export type HrefArgs<T extends keyof RegisterPages> = Parameters<typeof href<T>> extends [
	string,
	...infer Rest,
] ? Rest : [];

export type RoutePath<TPath extends keyof RegisterPages> = TPath;
