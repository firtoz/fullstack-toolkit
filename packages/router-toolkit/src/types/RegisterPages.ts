import type { Register } from "react-router";

type AnyParams = Record<string, string | undefined>;
type AnyPages = Record<
	string,
	{
		params: AnyParams;
	}
>;

export type RegisterPages = Register extends {
	pages: infer Registered extends AnyPages;
}
	? Registered
	: AnyPages;
