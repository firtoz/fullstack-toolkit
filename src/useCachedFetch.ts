import { useEffect, useMemo, useState } from "react";
import { href, type useLoaderData } from "react-router";
import type { HrefArgs } from "./types/HrefArgs";
import type { RouteWithLoaderModule } from "./types/RouteWithLoaderModule";

// Cache for the useCachedFetch hook (regular fetch, not useFetcher)
const fetchCache = new Map<string, unknown>();

// Hook that uses regular fetch instead of useFetcher to avoid route invalidation
export const useCachedFetch = <TInfo extends RouteWithLoaderModule>(
	path: TInfo["file"],
	...args: TInfo["file"] extends "undefined"
		? HrefArgs<"/">
		: HrefArgs<TInfo["file"]>
): {
	data: ReturnType<typeof useLoaderData<TInfo["loader"]>> | undefined;
	isLoading: boolean;
	error: Error | undefined;
} => {
	// Generate URL using href, same as useDynamicFetcher
	const url = useMemo(() => {
		// biome-ignore lint/suspicious/noExplicitAny: Complex conditional typing prevents TypeScript from inferring args when spreading
		return href<typeof path>(path, ...(args as any));
	}, [path, args]);

	// Use the generated URL as the cache key
	const cacheKey = url;

	// Local state
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | undefined>(undefined);
	const [data, setData] = useState<
		ReturnType<typeof useLoaderData<TInfo["loader"]>> | undefined
	>(() =>
		fetchCache.has(cacheKey)
			? (fetchCache.get(cacheKey) as ReturnType<
					typeof useLoaderData<TInfo["loader"]>
				>)
			: undefined,
	);

	// Auto-fetch on mount or when URL changes, if not in cache
	useEffect(() => {
		const fetchData = async () => {
			// Skip fetch if data is already cached
			if (fetchCache.has(cacheKey)) {
				return;
			}

			setIsLoading(true);
			setError(undefined);

			try {
				const response = await fetch(url);

				if (!response.ok) {
					throw new Error(`HTTP error! Status: ${response.status}`);
				}

				const result = await response.json();

				// Update cache and state
				fetchCache.set(cacheKey, result);
				setData(result as ReturnType<typeof useLoaderData<TInfo["loader"]>>);
			} catch (err) {
				setError(err instanceof Error ? err : new Error(String(err)));
			} finally {
				setIsLoading(false);
			}
		};

		fetchData();
	}, [url, cacheKey]);

	return { data, isLoading, error };
};
