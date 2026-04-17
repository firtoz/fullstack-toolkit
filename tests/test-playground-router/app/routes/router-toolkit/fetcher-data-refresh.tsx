import { type RoutePath, useDynamicFetcher } from "@firtoz/router-toolkit";
import { Link } from "react-router";
import type { Route } from "./+types/fetcher-data-refresh";

interface UserData {
	id: number;
	name: string;
	email: string;
	lastFetch: string;
	fetchCount: number;
}

export const loader = async ({
	request,
}: Route.LoaderArgs): Promise<{ user: UserData }> => {
	// Simulate API call
	await new Promise((resolve) => setTimeout(resolve, 500));

	// Get query params to track fetch count
	const url = new URL(request.url);
	const count = Number.parseInt(url.searchParams.get("count") || "0", 10);

	return {
		user: {
			id: 1,
			name: "Jane Doe",
			email: "jane@example.com",
			lastFetch: new Date().toISOString(),
			fetchCount: count + 1,
		},
	};
};

export function meta() {
	return [
		{ title: "Fetcher Data Refresh - Test Playground" },
		{
			name: "description",
			content:
				"Testing useDynamicFetcher for programmatic data fetching from loader",
		},
	];
}

export const route: RoutePath<"/router-toolkit/fetcher-data-refresh"> =
	"/router-toolkit/fetcher-data-refresh";

export default function FetcherDataRefresh() {
	const fetcher = useDynamicFetcher<typeof import("./fetcher-data-refresh")>(
		"/router-toolkit/fetcher-data-refresh",
	);

	const handleRefresh = () => {
		const currentCount = fetcher.data?.user.fetchCount || 0;
		fetcher.load({ count: String(currentCount) });
	};

	const currentData = fetcher.data;

	return (
		<div>
			<Link to="/">← Back to Home</Link>
			<h1>Fetcher Data Refresh Test</h1>
			<p>Testing useDynamicFetcher for fetching data from a loader endpoint</p>

			<div>
				{currentData && (
					<div>
						<h2>Current Data</h2>
						<pre data-testid="user-data">
							{JSON.stringify(currentData.user, null, 2)}
						</pre>
					</div>
				)}

				<div>
					<h2>Fetcher State:</h2>
					<pre data-testid="fetcher-state">
						{JSON.stringify({ state: fetcher.state }, null, 2)}
					</pre>
				</div>

				<div>
					<button
						type="button"
						onClick={handleRefresh}
						disabled={fetcher.state !== "idle"}
						data-testid="refresh-button"
					>
						{fetcher.state === "loading"
							? "Loading..."
							: "Refresh Data (fetcher.load)"}
					</button>
				</div>

				<div>
					<p>📚 What's being tested:</p>
					<ul>
						<li>
							<strong>useDynamicFetcher</strong> - For fetching data from
							loaders
						</li>
						<li>
							<strong>fetcher.load()</strong> - Programmatic data refresh
						</li>
						<li>
							<strong>Loading states</strong> - idle → loading → idle
						</li>
						<li>
							<strong>Type-safe data</strong> - Full type inference from loader
						</li>
					</ul>
				</div>
			</div>
		</div>
	);
}
