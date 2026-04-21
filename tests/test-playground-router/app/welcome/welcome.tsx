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
		path: href("/router-toolkit/key-suffix-dual-submitter-test"),
		text: "useDynamicSubmitter keySuffix (dual)",
		description:
			"Two submitters to the same action with different fetcher keys; E2E overlap",
	},
	{
		path: href("/router-toolkit/shared-fetcher-key-dual-submitter-test"),
		text: "useDynamicSubmitter shared key (dual)",
		description:
			"No keySuffix: shared fetcher state/data; overlapping submit supersedes earlier",
	},
	{
		path: "/router-toolkit/concurrent-submitter-test",
		text: "useConcurrentSubmitter (Provider)",
		description:
			"Concurrent submissions via global provider; uses framework fetcher",
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
