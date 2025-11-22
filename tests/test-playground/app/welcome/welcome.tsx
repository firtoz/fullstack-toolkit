import { href, Link } from "react-router";

export function Welcome() {
	return (
		<div>
			<nav>
				<h2>@firtoz/router-toolkit Test Routes</h2>
				<ul>
					{routerToolkitRoutes.map(({ path, text, description }) => (
						<li key={path}>
							<Link to={path}>
								<div>{text}</div>
								<div>{description}</div>
							</Link>
						</li>
					))}
				</ul>
			</nav>

			<nav>
				<h2>@firtoz/drizzle-sqlite-wasm Test Routes</h2>
				<ul>
					{collectionRoutes.map(({ path, text, description }) => (
						<li key={path}>
							<a href={path}>
								<div>{text}</div>
								<div>{description}</div>
							</a>
						</li>
					))}
				</ul>
			</nav>
		</div>
	);
}

const routerToolkitRoutes = [
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

const collectionRoutes = [
	{
		path: href("/collections/sqlite-test"),
		text: "DrizzleSqliteProvider + useCollection",
		description:
			"SQLite WASM with Drizzle ORM: Real-time queries with live updates using useLiveQuery",
	},
	{
		path: href("/collections/indexeddb-test"),
		text: "DrizzleIndexedDBProvider + useCollection",
		description:
			"IndexedDB with Drizzle Collections: Real-time queries with live updates using useLiveQuery",
	},
	{
		path: href("/collections/indexeddb-migration-test"),
		text: "IndexedDB Migration Test",
		description:
			"Test generated IndexedDB migrations from Drizzle schema snapshots",
	},
	{
		path: `${href("/collections/sync-mode-test")}?mode=on-demand`,
		text: "Sync Mode Integration Test (IndexedDB)",
		description:
			"Compare eager vs on-demand sync modes with IndexedDB operation tracking",
	},
	{
		path: "/collections/sqlite-sync-mode-test?mode=on-demand",
		text: "Sync Mode Integration Test (SQLite WASM)",
		description:
			"Compare eager vs on-demand sync modes with SQLite operation tracking",
	},
	{
		path: href("/api/clear-opfs"),
		text: "Clear OPFS Storage",
		description:
			"Clear all Origin Private File System (OPFS) storage and view file directory structure",
	},
];
