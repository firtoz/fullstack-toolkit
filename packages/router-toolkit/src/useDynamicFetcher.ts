import { useCallback, useMemo } from "react";
import { href, useFetcher } from "react-router";
import type { HrefArgs } from "./types/HrefArgs";
import type { RouteWithLoaderModule } from "./types/RouteWithLoaderModule";

export const useDynamicFetcher = <TInfo extends RouteWithLoaderModule>(
	path: TInfo["route"],
	...args: TInfo["route"] extends "undefined"
		? HrefArgs<"/">
		: HrefArgs<TInfo["route"]>
): Omit<ReturnType<typeof useFetcher<TInfo["loader"]>>, "load" | "submit"> & {
	load: (queryParams?: Record<string, string>) => Promise<void>;
} => {
	const url = useMemo(() => {
		return href(path, ...args);
	}, [path, args]);

	const fetcher = useFetcher<TInfo["loader"]>({
		key: `fetcher-${url}`,
	});

	const load = useCallback(
		(queryParams?: Record<string, string>) => {
			if (!queryParams || Object.keys(queryParams).length === 0) {
				return fetcher.load(url);
			}

			// Build URL with query parameters
			const urlObj = new URL(url, window.location.origin);
			for (const [key, value] of Object.entries(queryParams)) {
				urlObj.searchParams.set(key, value);
			}

			return fetcher.load(urlObj.pathname + urlObj.search);
		},
		[fetcher.load, url],
	);

	return {
		...fetcher,
		load,
	};
};
