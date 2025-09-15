import {
	type RoutePath,
	useDynamicFetcher,
	useDynamicSubmitter,
} from "@firtoz/router-toolkit";
import { useLoaderData } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/combined-test";

interface User {
	id: number;
	name: string;
	email: string;
	lastUpdated: string;
}

interface LoaderData {
	user: User;
}

type ActionData = {
	success: boolean;
	message: string;
	updatedUser?: User;
};

export const loader = async (): Promise<LoaderData> => {
	// Simulate API call delay
	await new Promise((resolve) => setTimeout(resolve, 300));

	return {
		user: {
			id: 1,
			name: "John Doe",
			email: "john@example.com",
			lastUpdated: new Date().toISOString(),
		},
	};
};

export async function action({
	request,
}: Route.ActionArgs): Promise<ActionData> {
	const formData = await request.formData();
	const name = formData.get("name") as string;
	const email = formData.get("email") as string;

	// Simulate processing delay
	await new Promise((resolve) => setTimeout(resolve, 500));

	// Simple validation
	if (!name || !email) {
		return {
			success: false,
			message: "Name and email are required",
		};
	}

	const updatedUser: User = {
		id: 1,
		name,
		email,
		lastUpdated: new Date().toISOString(),
	};

	return {
		success: true,
		message: "User updated successfully!",
		updatedUser,
	};
}

export function meta() {
	return [
		{ title: "Combined Test - Router Toolkit" },
		{
			name: "description",
			content: "Testing useDynamicFetcher and useDynamicSubmitter hooks",
		},
	];
}

export const route: RoutePath<"/combined-test"> = "/combined-test";

export const formSchema = z.object({
	name: z.string().min(1),
	email: z.email(),
});

export default function CombinedTest() {
	const loaderData = useLoaderData<LoaderData>();
	// Router-toolkit hooks would be used here with proper setup:
	const fetcher =
		useDynamicFetcher<typeof import("./combined-test")>("/combined-test");
	const submitter =
		useDynamicSubmitter<typeof import("./combined-test")>("/combined-test");
	// const fetcher = useFetcher<ActionData>();

	return (
		<div className="p-6">
			<h1 className="text-2xl font-bold mb-4">Combined Test</h1>
			<p className="mb-4">Testing both loader data and form actions</p>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				{/* Loader Data Section */}
				<div>
					<h2 className="text-lg font-semibold mb-3">Current User Data</h2>
					<div className="bg-blue-50 p-4 rounded">
						<h3 className="font-medium">Loaded from Server:</h3>
						<pre className="mt-2 text-sm bg-gray-200 p-3 rounded text-gray-800">
							{JSON.stringify(loaderData.user, null, 2)}
						</pre>
					</div>
				</div>

				{/* Action Form Section */}
				<div>
					<h2 className="text-lg font-semibold mb-3">Update User</h2>
					<fetcher.Form method="post" className="space-y-4">
						<div>
							<label htmlFor="name" className="block text-sm font-medium mb-1">
								Name:
							</label>
							<input
								id="name"
								name="name"
								type="text"
								defaultValue={loaderData.user.name}
								required
								className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
						</div>

						<div>
							<label htmlFor="email" className="block text-sm font-medium mb-1">
								Email:
							</label>
							<input
								id="email"
								name="email"
								type="email"
								defaultValue={loaderData.user.email}
								required
								className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
						</div>

						<button
							type="submit"
							disabled={fetcher.state === "submitting"}
							className="bg-purple-500 text-white px-4 py-2 rounded disabled:opacity-50"
						>
							{fetcher.state === "submitting" ? "Updating..." : "Update User"}
						</button>
					</fetcher.Form>
				</div>
			</div>

			{/* Status Section */}
			<div className="mt-6">
				<h2 className="text-lg font-semibold mb-2">Action Status:</h2>
				<pre className="bg-gray-200 p-3 rounded text-sm text-gray-800">
					{JSON.stringify({ state: fetcher.state }, null, 2)}
				</pre>
			</div>

			{submitter.data && (
				<div className="mt-6">
					<h2 className="text-lg font-semibold mb-2">Action Result:</h2>
					<pre className="bg-gray-200 p-3 rounded text-sm text-gray-800">
						{JSON.stringify(fetcher.data, null, 2)}
					</pre>

					{submitter.data.success ? (
						<div className="mt-4 p-3 bg-green-100 rounded">
							<p className="text-green-800">✅ {submitter.data.message}</p>
							{submitter.data.updatedUser && (
								<p className="text-sm text-green-700 mt-1">
									Tip: Reload the page to see if data persists (it won't in this
									demo)
								</p>
							)}
						</div>
					) : (
						<div className="mt-4 p-3 bg-red-100 rounded">
							<p className="text-red-800">❌ {submitter.data.message}</p>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
