import { type RoutePath, useDynamicFetcher } from "@firtoz/router-toolkit";
import { Link } from "react-router";

interface LoaderData {
	user: {
		id: number;
		name: string;
		email: string;
	};
	timestamp: string;
}

export const loader = async (): Promise<LoaderData> => {
	// Simulate API call delay
	await new Promise((resolve) => setTimeout(resolve, 500));

	// Return test user data
	return {
		user: {
			id: 1,
			name: "John Doe",
			email: "john@example.com",
		},
		timestamp: new Date().toISOString(),
	};
};

export function meta() {
	return [
		{ title: "Loader Test - Test Playground" },
		{ name: "description", content: "Testing @firtoz/router-toolkit hooks" },
	];
}

export const route: RoutePath<"/router-toolkit/loader-test"> =
	"/router-toolkit/loader-test";

export default function LoaderTest() {
	const fetcher = useDynamicFetcher<typeof import("./loader-test")>(
		"/router-toolkit/loader-test",
	);

	const handleRefresh = () => {
		fetcher.load();
	};

	return (
		<div>
			<Link to="/">← Back to Home</Link>
			<h1>Loader Test</h1>
			<p>Testing React Router useFetcher hook</p>

			<button
				type="button"
				onClick={handleRefresh}
				disabled={fetcher.state === "loading"}
			>
				{fetcher.state === "loading" ? "Loading..." : "Refresh Data"}
			</button>

			<div>
				<h2>Fetcher State:</h2>
				<pre>{JSON.stringify({ state: fetcher.state }, null, 2)}</pre>
			</div>

			{fetcher.data && (
				<div>
					<h2>Fetched Data:</h2>
					<pre>{JSON.stringify(fetcher.data, null, 2)}</pre>
				</div>
			)}

			{fetcher.state === "idle" && fetcher.data && (
				<div>
					<p>✅ Data loaded successfully!</p>
				</div>
			)}
		</div>
	);
}
