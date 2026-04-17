import { type RoutePath, useDynamicFetcher } from "@firtoz/router-toolkit";
import { useState } from "react";
import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/fetcher-invalidation";

interface TimeData {
	timestamp: string;
	loadCount: number;
	message: string;
}

export const loader = async ({ request }: Route.LoaderArgs) => {
	// Get query param to track load count
	const url = new URL(request.url);
	const count = Number.parseInt(url.searchParams.get("count") || "0", 10);

	// Simulate some delay
	await new Promise((resolve) => setTimeout(resolve, 300));

	return {
		timestamp: new Date().toISOString(),
		loadCount: count + 1,
		message: `Data loaded at ${new Date().toLocaleTimeString()}`,
	};
};

export function meta() {
	return [
		{ title: "Fetcher Invalidation - Test Playground" },
		{
			name: "description",
			content: "Testing useDynamicFetcher data invalidation and revalidation",
		},
	];
}

export const route: RoutePath<"/router-toolkit/fetcher-invalidation"> =
	"/router-toolkit/fetcher-invalidation";

export default function FetcherInvalidation() {
	const initialData = useLoaderData<TimeData>();
	const [fetchHistory, setFetchHistory] = useState<TimeData[]>([initialData]);

	const fetcher = useDynamicFetcher<typeof import("./fetcher-invalidation")>(
		"/router-toolkit/fetcher-invalidation",
	);

	const handleLoadData = () => {
		const currentCount = fetcher.data?.loadCount || initialData.loadCount;
		fetcher.load({ count: String(currentCount) });
	};

	const handleLoadAndTrack = () => {
		handleLoadData();
	};

	// Add to history when fetcher completes
	if (fetcher.data && fetcher.state === "idle") {
		const lastHistoryItem = fetchHistory[fetchHistory.length - 1];
		if (lastHistoryItem?.timestamp !== fetcher.data.timestamp) {
			setFetchHistory([...fetchHistory, fetcher.data]);
		}
	}

	const currentData = fetcher.data || initialData;

	return (
		<div>
			<Link to="/">← Back to Home</Link>
			<h1>Fetcher Invalidation Test</h1>
			<p>
				Testing useDynamicFetcher data invalidation - each fetch should return a
				different timestamp
			</p>

			<div>
				<div>
					<h2>Current Data</h2>
					<div>
						<div data-testid="current-timestamp">
							<strong>Timestamp:</strong> {currentData.timestamp}
						</div>
						<div data-testid="load-count">
							<strong>Load Count:</strong> {currentData.loadCount}
						</div>
						<div>{currentData.message}</div>
					</div>
				</div>

				<div>
					<h2>Fetcher State:</h2>
					<pre data-testid="fetcher-state">
						{JSON.stringify({ state: fetcher.state }, null, 2)}
					</pre>
				</div>

				<div>
					<button
						type="button"
						onClick={handleLoadAndTrack}
						disabled={fetcher.state !== "idle"}
						data-testid="invalidate-button"
					>
						{fetcher.state === "loading"
							? "Revalidating..."
							: "Invalidate & Reload Data"}
					</button>
				</div>

				<div>
					<h2>Fetch History (Shows Data Invalidation)</h2>
					<div data-testid="fetch-history">
						{fetchHistory.map((data, index) => (
							<div key={data.timestamp} data-fetch-index={index}>
								<div>
									Fetch #{data.loadCount} {index === 0 && "(Initial Page Load)"}
									{index === fetchHistory.length - 1 && index > 0 && "(Latest)"}
								</div>
								<div>{data.timestamp}</div>
								<div>{data.message}</div>
							</div>
						))}
					</div>
				</div>

				<div>
					<p>📚 What's being tested:</p>
					<ul>
						<li>
							<strong>Data Invalidation</strong> - Each fetch returns fresh data
						</li>
						<li>
							<strong>Timestamp Changes</strong> - Proves data is actually
							reloading
						</li>
						<li>
							<strong>fetcher.load()</strong> - Programmatic revalidation
						</li>
						<li>
							<strong>State Management</strong> - Tracking loading/idle states
						</li>
					</ul>
				</div>
			</div>
		</div>
	);
}
