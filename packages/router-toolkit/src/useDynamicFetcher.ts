/**
 * @fileoverview Type-safe dynamic data fetching hook for React Router 7
 *
 * This module provides a hook that creates a type-safe fetcher for loading data
 * from dynamic routes with full TypeScript inference for the loader response and route params.
 *
 * @example
 * ### Route Setup (`app/routes/api.users.$userId.ts`)
 *
 * First, set up your route with the required exports:
 *
 * ```typescript
 * import type { RoutePath } from "@firtoz/router-toolkit";
 *
 * // Export the route path for type inference
 * export const route: RoutePath<"/api/users/:userId"> = "/api/users/:userId";
 *
 * // Define the loader with a typed return value
 * export const loader = async ({ params }: LoaderFunctionArgs) => {
 *   const user = await db.users.findUnique({ where: { id: params.userId } });
 *   return {
 *     user: {
 *       id: user.id,
 *       email: user.email,
 *       displayName: user.displayName,
 *       createdAt: user.createdAt.toISOString(),
 *     },
 *   };
 * };
 * ```
 *
 * @example
 * ### Using the hook in a component
 *
 * ```tsx
 * import { useDynamicFetcher } from "@firtoz/router-toolkit";
 * import { useEffect } from "react";
 *
 * function UserProfile({ userId }: { userId: string }) {
 *   // Type-safe fetcher with full inference
 *   const fetcher = useDynamicFetcher<typeof import("./api.users.$userId")>(
 *     "/api/users/:userId",
 *     { userId }
 *   );
 *
 *   // Load data on mount
 *   useEffect(() => {
 *     fetcher.load();
 *   }, [fetcher.load]);
 *
 *   // fetcher.data is fully typed: { user: { id, email, displayName, createdAt } } | undefined
 *   if (fetcher.state === "loading") {
 *     return <div>Loading...</div>;
 *   }
 *
 *   if (!fetcher.data) {
 *     return <div>No user found</div>;
 *   }
 *
 *   return (
 *     <div>
 *       <h1>{fetcher.data.user.displayName}</h1>
 *       <p>{fetcher.data.user.email}</p>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ### Loading with query parameters
 *
 * ```tsx
 * function SearchResults() {
 *   const fetcher = useDynamicFetcher<typeof import("./api.search")>("/api/search");
 *
 *   const handleSearch = (query: string, page: number) => {
 *     // Pass query params to the load function
 *     fetcher.load({ q: query, page: String(page) });
 *   };
 *
 *   return (
 *     <div>
 *       <input onChange={(e) => handleSearch(e.target.value, 1)} />
 *       {fetcher.data?.results.map((result) => (
 *         <div key={result.id}>{result.title}</div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ### Combining with useDynamicSubmitter for full CRUD
 *
 * You can use `useDynamicFetcher` alongside `useDynamicSubmitter` to create
 * complete CRUD interfaces with type safety:
 *
 * ```tsx
 * import { useDynamicFetcher, useDynamicSubmitter } from "@firtoz/router-toolkit";
 *
 * function PostEditor({ postId }: { postId: string }) {
 *   // Fetch post data
 *   const fetcher = useDynamicFetcher<typeof import("./api.posts.$postId")>(
 *     "/api/posts/:postId",
 *     { postId }
 *   );
 *
 *   // Submit updates
 *   const submitter = useDynamicSubmitter<typeof import("./api.posts.$postId")>(
 *     "/api/posts/:postId",
 *     { postId }
 *   );
 *
 *   useEffect(() => {
 *     fetcher.load();
 *   }, [fetcher.load]);
 *
 *   const handleSave = async (title: string, content: string) => {
 *     await submitter.submitJson({ title, content }, { method: "PUT" });
 *     // Reload after save
 *     fetcher.load();
 *   };
 *
 *   if (!fetcher.data) return <div>Loading...</div>;
 *
 *   return (
 *     <form onSubmit={(e) => {
 *       e.preventDefault();
 *       const form = new FormData(e.currentTarget);
 *       handleSave(form.get("title") as string, form.get("content") as string);
 *     }}>
 *       <input name="title" defaultValue={fetcher.data.post.title} />
 *       <textarea name="content" defaultValue={fetcher.data.post.content} />
 *       <button disabled={submitter.state !== "idle"}>
 *         {submitter.state === "submitting" ? "Saving..." : "Save"}
 *       </button>
 *     </form>
 *   );
 * }
 * ```
 */

import { useCallback, useMemo } from "react";
import { href, useFetcher } from "react-router";
import type { HrefArgs } from "./types/HrefArgs";
import type { RouteWithLoaderModule } from "./types/RouteWithLoaderModule";

/**
 * Creates a type-safe fetcher for loading data from dynamic routes.
 *
 * This hook provides full TypeScript inference for:
 * - Route parameters (from the route path)
 * - Loader response type (from the route's loader export)
 *
 * @template TInfo - The route module type (use `typeof import("./route-file")`)
 *
 * @param path - The route path (must match the route's `route` export)
 * @param args - Route parameters (if the route has dynamic segments like `:id`)
 *
 * @returns An extended fetcher object with:
 * - `load` - Function to load data, optionally with query parameters
 * - `data` - Response data from the loader (typed)
 * - `state` - Fetcher state ("idle" | "loading" | "submitting")
 * - All other useFetcher properties (except `submit`)
 *
 * @example
 * ### Basic usage
 *
 * ```typescript
 * // In your route file (app/routes/api.products.$productId.ts):
 * export const route: RoutePath<"/api/products/:productId"> = "/api/products/:productId";
 * export const loader = async ({ params }: LoaderFunctionArgs) => {
 *   return { product: await getProduct(params.productId) };
 * };
 *
 * // In your component:
 * const fetcher = useDynamicFetcher<typeof import("./api.products.$productId")>(
 *   "/api/products/:productId",
 *   { productId: "abc123" }
 * );
 *
 * useEffect(() => {
 *   fetcher.load();
 * }, [fetcher.load]);
 *
 * // fetcher.data is typed as { product: Product } | undefined
 * ```
 *
 * @example
 * ### With query parameters
 *
 * ```typescript
 * const fetcher = useDynamicFetcher<typeof import("./api.search")>("/api/search");
 *
 * // Load with query params: /api/search?q=hello&limit=10
 * fetcher.load({ q: "hello", limit: "10" });
 * ```
 */
export const useDynamicFetcher = <TInfo extends RouteWithLoaderModule>(
	path: TInfo["route"],
	...args: TInfo["route"] extends "undefined"
		? HrefArgs<"/">
		: HrefArgs<TInfo["route"]>
): Omit<ReturnType<typeof useFetcher<TInfo["loader"]>>, "load" | "submit"> & {
	/**
	 * Load data from the route's loader.
	 *
	 * @param queryParams - Optional query parameters to append to the URL
	 * @returns A promise that resolves when the load is complete
	 *
	 * @example
	 * ```typescript
	 * // Load without query params
	 * fetcher.load();
	 *
	 * // Load with query params
	 * fetcher.load({ page: "2", sort: "name" });
	 * ```
	 */
	load: (queryParams?: Record<string, string>) => Promise<void>;
} => {
	const url = useMemo(() => {
		// biome-ignore lint/suspicious/noExplicitAny: Intentional
		return href(path, ...(args as any));
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
