import type { Hono } from "hono";
import { honoFetcher, type TypedHonoFetcher } from "./honoFetcher";

export const honoDirectFetcher = <T extends Hono>(
	baseUrl: string,
): TypedHonoFetcher<T> => {
	return honoFetcher<T>((request, init) => {
		return fetch(`${baseUrl}${request}`, init) as ReturnType<T["request"]>;
	});
};
