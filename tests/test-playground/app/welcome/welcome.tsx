import { href, Link } from "react-router";

type RouteItem = {
	path: string;
	text: string;
	description: string;
};

const RouteList = ({ routes }: { routes: RouteItem[] }) => (
	<ul>
		{routes.map(({ path, text, description }) => (
			<li key={path}>
				<Link to={path}>
					<div>{text}</div>
					<div>{description}</div>
				</Link>
			</li>
		))}
	</ul>
);

export function Welcome() {
	return (
		<div>
			<nav>
				<h2>@firtoz/router-toolkit</h2>
				<RouteList routes={routerToolkitRoutes} />
			</nav>

			<nav>
				<h2>@firtoz/drizzle-indexeddb</h2>
				<RouteList routes={indexedDBRoutes} />
			</nav>

			<nav>
				<h2>@firtoz/drizzle-sqlite-wasm</h2>
				<RouteList routes={sqliteRoutes} />
			</nav>

			<nav>
				<h2>@firtoz/db-helpers</h2>
				<RouteList routes={dbHelpersRoutes} />
			</nav>

			<nav>
				<h2>Utilities</h2>
				<RouteList routes={utilityRoutes} />
			</nav>
		</div>
	);
}

const routerToolkitRoutes: RouteItem[] = [
	{
		path: href("/router-toolkit/loader-test"),
		text: "useDynamicFetcher (Loader)",
		description:
			"Test route with data loading functionality using React Router's useFetcher hook",
	},
	{
		path: href("/router-toolkit/action-test"),
		text: "useDynamicSubmitter (Action)",
		description:
			"Test route with form submission and action handling capabilities",
	},
	{
		path: href("/router-toolkit/form-action-test"),
		text: "formAction + useDynamicSubmitter",
		description: "Form validation with Zod schema and type-safe error handling",
	},
	{
		path: href("/router-toolkit/submitter-with-loader"),
		text: "useDynamicSubmitter + useLoaderData",
		description: "Form submissions working alongside loader data",
	},
	{
		path: href("/router-toolkit/fetcher-data-refresh"),
		text: "useDynamicFetcher (Data Fetching)",
		description: "Programmatic data fetching from loaders using fetcher.load()",
	},
	{
		path: href("/router-toolkit/fetcher-invalidation"),
		text: "useDynamicFetcher (Invalidation)",
		description:
			"Data invalidation and revalidation with timestamp verification",
	},
];

const indexedDBRoutes: RouteItem[] = [
	{
		path: href("/collections/indexeddb-test"),
		text: "DrizzleIndexedDBProvider + useCollection",
		description: "Real-time queries with live updates using useLiveQuery",
	},
	{
		path: href("/collections/indexeddb-migration-test"),
		text: "Migration Test",
		description:
			"Test generated IndexedDB migrations from Drizzle schema snapshots",
	},
	{
		path: `${href("/collections/sync-mode-test")}?mode=on-demand`,
		text: "Sync Mode Test",
		description:
			"Compare eager vs on-demand sync modes with operation tracking",
	},
	{
		path: href("/collections/pagination-test"),
		text: "Pagination Test",
		description:
			"Test limit/offset pagination with load more and page navigation",
	},
];

const sqliteRoutes: RouteItem[] = [
	{
		path: href("/collections/sqlite-test"),
		text: "DrizzleSqliteProvider + useCollection",
		description: "Real-time queries with live updates using useLiveQuery",
	},
	{
		path: "/collections/sqlite-sync-mode-test?mode=on-demand",
		text: "Sync Mode Test",
		description:
			"Compare eager vs on-demand sync modes with operation tracking",
	},
	{
		path: href("/collections/sqlite-pagination-test"),
		text: "Pagination Test",
		description:
			"Test native SQL LIMIT/OFFSET pagination with load more and page navigation",
	},
];

const dbHelpersRoutes: RouteItem[] = [
	{
		path: href("/collections/memory-collection-test"),
		text: "Memory Collection",
		description:
			"In-memory TanStack DB collection — data vanishes on refresh (no persistence)",
	},
	{
		path: href("/collections/memory-collection-n-sync-test"),
		text: "N Collections Sync",
		description:
			"N memory collections that broadcast to each other; add/remove count, initial sync when adding",
	},
];

const utilityRoutes: RouteItem[] = [
	{
		path: href("/api/clear-opfs"),
		text: "Clear OPFS Storage",
		description:
			"Clear all Origin Private File System (OPFS) storage and view file directory",
	},
];
